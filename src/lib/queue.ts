/**
 * Sistema de Fila de Reprodução (AutoDJ + Pedidos)
 *
 * Mantém, em memória, uma fila de até QUEUE_SIZE músicas por gênero/mountpoint.
 * A fila é a fonte única de verdade tanto para `/api/music` (o que será
 * servido ao Liquidsoap) quanto para o bloco "Próximas" da UI.
 *
 * Pedidos (apenas gênero "geral") ocupam o bloco inicial contíguo da fila,
 * na ordem de chegada — empurrando os itens escolhidos pelo AutoDJ para o
 * final. `syncRequestsInQueue` deve ser chamada após qualquer mutação na
 * tabela `requests` para manter essa invariante.
 *
 * `ensureQueue` completa a fila até QUEUE_SIZE com sorteios ponderados pela
 * rotação, respeitando timeSlots, gênero e proteções (histórico/artistas
 * recentes). Refill só ocorre quando a fila cai abaixo de QUEUE_SIZE — um
 * pedido pode deixá-la temporariamente acima disso.
 */

import { db } from "@/db";
import { songs, requests, history, likes } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import { checkFileExists } from "@/lib/file";
import { logAction } from "@/lib/logging";
import { ROTATION_WEIGHTS, type RotationType } from "@/lib/rotation";

export const QUEUE_SIZE = 10;

export interface QueueEntry {
  id: number;
  title: string;
  artist: string;
  path: string;
  cover: string | null;
  genre: string;
  allowedInGeneral: number;
  source: "request" | "autodj";
  requestId?: number;
  requestedAt?: number | null;
}

type SongRow = typeof songs.$inferSelect;

// Server Actions e Route Handlers podem ser empacotados em bundles
// separados pelo Next.js, cada um com sua própria instância deste módulo.
// Para garantir que `requestSong` (Server Action) e `/api/music`/`/api/songs/next`
// (Route Handlers) compartilhem o mesmo estado de fila, guardamos os Maps em
// `globalThis` — mesmo padrão usado para `global.io` (src/socket.d.ts).
declare global {
  var __queueState:
    | {
        queues: Map<string, QueueEntry[]>;
        seeded: Set<string>;
        lastServed: Map<string, number>;
      }
    | undefined;
}

if (!globalThis.__queueState) {
  globalThis.__queueState = {
    queues: new Map<string, QueueEntry[]>(),
    seeded: new Set<string>(),
    lastServed: new Map<string, number>(),
  };
}

const queueState = globalThis.__queueState;

const queues = queueState.queues;
const seeded = queueState.seeded;
const lastServed = queueState.lastServed;

/**
 * Retorna uma cópia da fila atual do gênero (até QUEUE_SIZE+ itens se houver overflow).
 */
export function getQueue(genre: string): QueueEntry[] {
  return [...(queues.get(genre) || [])];
}

/**
 * Remove uma música do banco (e registros relacionados em `requests`,
 * `history` e `likes`) quando seu arquivo não é mais encontrado em disco.
 * Não tenta apagar o arquivo, que já está ausente.
 */
export async function removeMissingSong(song: {
  id: number;
  title: string;
  artist: string;
}): Promise<void> {
  await db.delete(requests).where(eq(requests.songId, song.id));
  await db.delete(history).where(eq(history.songId, song.id));
  await db.delete(likes).where(eq(likes.songId, song.id));
  await db.delete(songs).where(eq(songs.id, song.id));

  await syncRequestsInQueue("geral");

  await logAction({
    action: "song:deleted",
    targetType: "song",
    targetId: song.id,
    details: {
      title: song.title,
      artist: song.artist,
      reason: "missing_file",
    },
  });
}

/**
 * Remove e retorna o primeiro item da fila (próxima música a tocar).
 * Operação síncrona — segura sob concorrência.
 */
export function popNext(genre: string): QueueEntry | undefined {
  const queue = queues.get(genre);
  if (!queue || queue.length === 0) return undefined;

  const entry = queue.shift();
  if (entry) lastServed.set(genre, entry.id);
  return entry;
}

/**
 * Garante que a fila do gênero tenha QUEUE_SIZE itens, completando com
 * sorteios AutoDJ respeitando timeSlots/proteções/rotação. Não faz nada se
 * a fila já tiver QUEUE_SIZE ou mais itens.
 */
export async function ensureQueue(genre: string): Promise<void> {
  if (genre === "geral" && !seeded.has("geral")) {
    await syncRequestsInQueue("geral");
    seeded.add("geral");
  }

  let queue = queues.get(genre);
  if (!queue) {
    queue = [];
    queues.set(genre, queue);
  }

  if (queue.length >= QUEUE_SIZE) return;

  const excludeIds = new Set<number>(queue.map((e) => e.id));
  const last = lastServed.get(genre);
  if (last !== undefined) excludeIds.add(last);

  const pool = await pickAutoDjCandidates(
    genre,
    excludeIds,
    QUEUE_SIZE - queue.length,
  );

  while (queue.length < QUEUE_SIZE && pool.length > 0) {
    const song = weightedPickAndRemove(pool);
    if (!song) continue;

    if (!(await checkFileExists(song.path))) {
      console.warn(
        `[queue] Arquivo não encontrado: ${song.path} (songId=${song.id}) — removendo do banco`,
      );
      await removeMissingSong(song);
      continue;
    }

    queue.push({
      id: song.id,
      title: song.title,
      artist: song.artist,
      path: song.path,
      cover: song.cover,
      genre: song.genre || "geral",
      allowedInGeneral: song.allowedInGeneral || 0,
      source: "autodj",
    });
  }
}

/**
 * Reconstrói o bloco de pedidos da fila do "geral" a partir da tabela
 * `requests` (ordenada por `order`/`createdAt`), preservando os itens AutoDJ
 * já presentes (exceto duplicatas — pedido tem prioridade sobre AutoDJ).
 * Deve ser chamada após qualquer inserção/remoção/reordenação em `requests`.
 */
export async function syncRequestsInQueue(genre: string): Promise<void> {
  if (genre !== "geral") return;

  const pending = await db
    .select({
      requestId: requests.id,
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      path: songs.path,
      cover: songs.cover,
      genre: songs.genre,
      allowedInGeneral: songs.allowedInGeneral,
      requestedAt: requests.createdAt,
    })
    .from(requests)
    .innerJoin(songs, eq(requests.songId, songs.id))
    .orderBy(asc(requests.order), asc(requests.createdAt));

  const requestEntries: QueueEntry[] = pending.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    path: r.path,
    cover: r.cover,
    genre: r.genre || "geral",
    allowedInGeneral: r.allowedInGeneral || 0,
    source: "request",
    requestId: r.requestId,
    requestedAt: r.requestedAt ? Number(r.requestedAt) : null,
  }));

  const requestSongIds = new Set(requestEntries.map((e) => e.id));

  const current = queues.get(genre) || [];
  const autodjEntries = current.filter(
    (e) => e.source === "autodj" && !requestSongIds.has(e.id),
  );

  queues.set(genre, [...requestEntries, ...autodjEntries]);
}

async function fetchGenrePool(
  genre: string,
  ignoreTimeSlot: boolean,
): Promise<{
  availableSongs: SongRow[];
  blockedData: { songIds: number[]; artists: string[] };
}> {
  const blockedData = await getBlockedSongIds(genre);

  const genreCondition =
    genre === "geral"
      ? sql`(${songs.genre} = 'geral' OR ${songs.allowedInGeneral} = 1)`
      : sql`${songs.genre} = ${genre}`;

  const timeSlotCondition = ignoreTimeSlot
    ? sql`1=1`
    : sql`(${songs.timeSlots} & ${getCurrentTimeSlot()}) > 0`;

  const availableSongs = await db
    .select()
    .from(songs)
    .where(and(timeSlotCondition, genreCondition));

  return { availableSongs, blockedData };
}

/**
 * Aplica as proteções de repetição a um pool, com 3 níveis de rigor:
 * - "none": respeita histórico de músicas e artistas recentes (padrão).
 * - "artists": ignora a proteção de artista recente.
 * - "all": ignora toda proteção de repetição (mantém apenas timeSlot/gênero
 *   e `excludeIds`, que evita duplicar a fila atual/última música servida).
 */
function applyProtections(
  availableSongs: SongRow[],
  blockedData: { songIds: number[]; artists: string[] },
  excludeIds: Set<number>,
  relax: "none" | "artists" | "all",
): SongRow[] {
  return availableSongs.filter((song) => {
    if (excludeIds.has(song.id)) return false;
    if (relax === "all") return true;
    if (blockedData.songIds.includes(song.id)) return false;
    if (relax === "artists") return true;
    return !blockedData.artists.includes(song.artist);
  });
}

/**
 * Tenta preencher `needed` vagas para um pool já buscado, subindo a escada de
 * relaxamento de proteções (none -> artists -> all) só até onde for
 * necessário.
 */
function relaxUntilEnough(
  availableSongs: SongRow[],
  blockedData: { songIds: number[]; artists: string[] },
  excludeIds: Set<number>,
  needed: number,
): SongRow[] {
  let pool = applyProtections(availableSongs, blockedData, excludeIds, "none");
  if (pool.length >= needed) return pool;

  const relaxedArtists = applyProtections(
    availableSongs,
    blockedData,
    excludeIds,
    "artists",
  );
  if (relaxedArtists.length > pool.length) pool = relaxedArtists;
  if (pool.length >= needed) return pool;

  const relaxedAll = applyProtections(
    availableSongs,
    blockedData,
    excludeIds,
    "all",
  );
  if (relaxedAll.length > pool.length) pool = relaxedAll;

  return pool;
}

/**
 * Busca o pool de músicas disponíveis para o gênero, relaxando
 * progressivamente as restrições quando a biblioteca é pequena demais para
 * preencher `needed` vagas — sem isso, a fila (e o bloco "Próximas") fica
 * permanentemente abaixo de QUEUE_SIZE. Ordem de relaxamento:
 * 1. Gênero + horário atual, com proteções de histórico/artista.
 * 2. Mesmo pool, relaxando as proteções (artista recente, depois histórico).
 * 3. Ignora o filtro de horário (último recurso: tocar fora do horário ideal
 *    é melhor do que a fila ficar incompleta).
 * 4. Repete os passos acima caindo para o pool do "geral", se o gênero
 *    específico ainda não tiver candidatos suficientes.
 */
async function pickAutoDjCandidates(
  genre: string,
  excludeIds: Set<number>,
  needed: number,
): Promise<SongRow[]> {
  const tryGenre = async (g: string): Promise<SongRow[]> => {
    const inSlot = await fetchGenrePool(g, false);
    let pool = relaxUntilEnough(
      inSlot.availableSongs,
      inSlot.blockedData,
      excludeIds,
      needed,
    );
    if (pool.length >= needed) return pool;

    const anySlot = await fetchGenrePool(g, true);
    const relaxed = relaxUntilEnough(
      anySlot.availableSongs,
      anySlot.blockedData,
      excludeIds,
      needed,
    );
    if (relaxed.length > pool.length) pool = relaxed;

    return pool;
  };

  let pool = await tryGenre(genre);

  // Gêneros com poucas músicas (ex: 1 única em "modao") podem ficar sem
  // candidatos suficientes mesmo sem nenhuma proteção — cai para o pool do
  // "geral" também, repetindo a mesma escada de relaxamento.
  if (pool.length < needed && genre !== "geral") {
    const generalPool = await tryGenre("geral");
    if (generalPool.length > pool.length) pool = generalPool;
  }

  return pool;
}

/**
 * Sorteia uma música do pool ponderada pelo peso de rotação e a remove do
 * pool (mutação in-place). Retorna `null` (sem remover do array de saída,
 * exceto a primeira entrada inativa) se todas as músicas restantes tiverem
 * peso zero — permite ao chamador continuar tentando até o pool esvaziar.
 */
function weightedPickAndRemove(pool: SongRow[]): SongRow | null {
  if (pool.length === 0) return null;

  const weighted: { song: SongRow; index: number }[] = [];
  pool.forEach((song, index) => {
    const rotation = (song.rotation || "normal") as RotationType;
    const weight = ROTATION_WEIGHTS[rotation];
    for (let i = 0; i < weight; i++) {
      weighted.push({ song, index });
    }
  });

  if (weighted.length === 0) {
    // Todas as músicas restantes são "inativo" (peso 0) — descarta uma para
    // evitar loop infinito e tenta de novo na próxima iteração.
    pool.splice(0, 1);
    return null;
  }

  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  pool.splice(pick.index, 1);
  return pick.song;
}
