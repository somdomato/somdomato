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
import { songs, requests } from "@/db/schema";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import { checkFileExists } from "@/lib/file";
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

const queues = new Map<string, QueueEntry[]>();
const seeded = new Set<string>();
const lastServed = new Map<string, number>();

/**
 * Retorna uma cópia da fila atual do gênero (até QUEUE_SIZE+ itens se houver overflow).
 */
export function getQueue(genre: string): QueueEntry[] {
  return [...(queues.get(genre) || [])];
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

  const candidates = await pickAutoDjCandidates(genre, excludeIds);

  const pool = candidates.filter((s) => !excludeIds.has(s.id));

  while (queue.length < QUEUE_SIZE && pool.length > 0) {
    const song = weightedPickAndRemove(pool);
    if (!song) continue;

    if (!(await checkFileExists(song.path))) {
      console.warn(
        `[queue] Arquivo não encontrado: ${song.path} (songId=${song.id})`,
      );
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

/**
 * Busca o pool de músicas disponíveis para o gênero no horário atual,
 * respeitando proteções (histórico/artistas recentes). Faz fallback para o
 * pool do "geral" se não houver nada disponível no gênero específico.
 */
async function pickAutoDjCandidates(
  genre: string,
  excludeIds: Set<number>,
): Promise<SongRow[]> {
  const blockedData = await getBlockedSongIds(genre);
  const currentTimeSlot = getCurrentTimeSlot();

  let genreCondition: ReturnType<typeof sql>;
  if (genre === "geral") {
    genreCondition = sql`(${songs.genre} = 'geral' OR ${songs.allowedInGeneral} = 1)`;
  } else {
    genreCondition = sql`${songs.genre} = ${genre}`;
  }

  const availableSongs = await db
    .select()
    .from(songs)
    .where(
      and(
        sql`(${songs.timeSlots} & ${currentTimeSlot}) > 0`,
        genreCondition,
        blockedData.songIds.length > 0
          ? notInArray(songs.id, blockedData.songIds)
          : sql`1=1`,
      ),
    );

  let filteredSongs = availableSongs.filter(
    (song) => !blockedData.artists.includes(song.artist),
  );

  // Pool "usável" considerando exclusões (fila atual + última música servida).
  // Gêneros com poucas músicas (ex: 1 única em "modao") podem ficar sem
  // candidatos válidos mesmo com filteredSongs não-vazio — nesse caso,
  // cair para o pool do "geral" também.
  const usableSongs = filteredSongs.filter((song) => !excludeIds.has(song.id));

  if (usableSongs.length === 0 && genre !== "geral") {
    const generalBlockedData = await getBlockedSongIds("geral");

    const generalSongs = await db
      .select()
      .from(songs)
      .where(
        and(
          sql`(${songs.timeSlots} & ${currentTimeSlot}) > 0`,
          sql`(${songs.genre} = 'geral' OR ${songs.allowedInGeneral} = 1)`,
          generalBlockedData.songIds.length > 0
            ? notInArray(songs.id, generalBlockedData.songIds)
            : sql`1=1`,
        ),
      );

    filteredSongs = generalSongs.filter(
      (song) => !generalBlockedData.artists.includes(song.artist),
    );
  }

  return filteredSongs;
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
