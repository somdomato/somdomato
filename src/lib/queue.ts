/**
 * Sistema de Fila de Reprodução (AutoDJ + Pedidos) — persistido em `queue_entries`
 *
 * Uma única timeline por gênero/mountpoint, guardada no banco, cobrindo
 * passado (status "played"/"skipped"), presente ("current") e futuro
 * ("scheduled"/"pending"). Ver o comentário em `@/db/schema.ts` para o
 * ciclo de vida completo dos status.
 *
 * `ensureQueue` completa o bloco "scheduled" até QUEUE_SIZE com sorteios
 * ponderados pela rotação, respeitando timeSlots, gênero e proteções
 * (histórico/artistas recentes). Refill só ocorre quando a fila cai abaixo
 * de QUEUE_SIZE — um pedido pode deixá-la temporariamente acima disso.
 *
 * Pedidos (apenas gênero "geral") ocupam posições negativas (sempre antes de
 * qualquer item "scheduled" do AutoDJ, cujas posições são >= 0).
 * `syncRequestsInQueue` deve ser chamada após qualquer mutação na tabela
 * `requests` para manter essa invariante.
 */

import { db } from "@/db";
import { songs, requests, history, likes, queueEntries } from "@/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import { checkFileExists } from "@/lib/file";
import { logAction } from "@/lib/logging";
import { ROTATION_WEIGHTS, type RotationType } from "@/lib/rotation";

export const QUEUE_SIZE = 10;

export interface QueueEntry {
  id: number;
  queueEntryId: number;
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

export interface ConfirmedCurrent {
  songId: number;
  title: string;
  artist: string;
  path: string;
  cover: string | null;
  genre: string;
  allowedInGeneral: number;
  wasRequested: boolean;
  requestedAt: number | null;
}

export interface FlushedStale {
  songId: number;
  title: string;
  artist: string;
  cover: string | null;
  genre: string;
  wasRequested: boolean;
  selectedAt: number;
}

type SongRow = typeof songs.$inferSelect;

/**
 * Retorna a fila atual do gênero (linhas "scheduled" + "pending", nessa
 * ordem — "pending" sempre tem a menor posição porque foi a primeira a ser
 * retirada do bloco "scheduled").
 */
export async function getQueue(genre: string): Promise<QueueEntry[]> {
  const rows = await db
    .select({
      queueEntryId: queueEntries.id,
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      path: songs.path,
      cover: songs.cover,
      genre: songs.genre,
      allowedInGeneral: songs.allowedInGeneral,
      source: queueEntries.source,
      requestId: queueEntries.requestId,
      requestedAt: queueEntries.requestedAt,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.genre, genre),
        inArray(queueEntries.status, ["scheduled", "pending"]),
      ),
    )
    .orderBy(asc(queueEntries.position), asc(queueEntries.id));

  return rows.map((r) => ({
    queueEntryId: r.queueEntryId,
    id: r.id,
    title: r.title,
    artist: r.artist,
    path: r.path,
    cover: r.cover,
    genre: r.genre || "geral",
    allowedInGeneral: r.allowedInGeneral || 0,
    source: r.source as "request" | "autodj",
    requestId: r.requestId ?? undefined,
    requestedAt: r.requestedAt ? Number(r.requestedAt) : null,
  }));
}

/**
 * Remove uma música do banco (e registros relacionados em `requests`,
 * `queue_entries` e `likes`) quando seu arquivo não é mais encontrado em disco.
 * Não tenta apagar o arquivo, que já está ausente.
 */
export async function removeMissingSong(song: {
  id: number;
  title: string;
  artist: string;
}): Promise<void> {
  await db.delete(requests).where(eq(requests.songId, song.id));
  await db.delete(queueEntries).where(eq(queueEntries.songId, song.id));
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
 * Move a primeira linha "scheduled" do gênero para "pending" (servida ao
 * Liquidsoap, aguardando confirmação via on_track) e a retorna.
 */
export async function popNext(genre: string): Promise<QueueEntry | undefined> {
  const [head] = await db
    .select({
      queueEntryId: queueEntries.id,
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      path: songs.path,
      cover: songs.cover,
      genre: songs.genre,
      allowedInGeneral: songs.allowedInGeneral,
      source: queueEntries.source,
      requestId: queueEntries.requestId,
      requestedAt: queueEntries.requestedAt,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(eq(queueEntries.genre, genre), eq(queueEntries.status, "scheduled")),
    )
    .orderBy(asc(queueEntries.position), asc(queueEntries.id))
    .limit(1);

  if (!head) return undefined;

  await db
    .update(queueEntries)
    .set({ status: "pending" })
    .where(eq(queueEntries.id, head.queueEntryId));

  return {
    queueEntryId: head.queueEntryId,
    id: head.id,
    title: head.title,
    artist: head.artist,
    path: head.path,
    cover: head.cover,
    genre: head.genre || "geral",
    allowedInGeneral: head.allowedInGeneral || 0,
    source: head.source as "request" | "autodj",
    requestId: head.requestId ?? undefined,
    requestedAt: head.requestedAt ? Number(head.requestedAt) : null,
  };
}

/**
 * Garante que a fila do gênero tenha QUEUE_SIZE itens "scheduled",
 * completando com sorteios AutoDJ respeitando timeSlots/proteções/rotação.
 * Não faz nada se a fila já tiver QUEUE_SIZE ou mais itens.
 */
export async function ensureQueue(genre: string): Promise<void> {
  // NÃO chamar syncRequestsInQueue aqui: ensureQueue é invocada a cada poll
  // do Liquidsoap e a cada refetch de "Próximas" — rebuildar o bloco de
  // pedidos nessa frequência cria uma janela onde leitores concorrentes
  // (getQueue/nextSongs) veem a fila de pedidos vazia ou duplicada no meio
  // do delete+insert. A sincronização já acontece nos pontos de mutação de
  // `requests` (requestSong, addRequest, deleteRequest, reorderRequests,
  // removeMissingSong) e na inicialização do servidor (src/server.ts).

  const scheduled = await db
    .select({ id: queueEntries.id, songId: queueEntries.songId })
    .from(queueEntries)
    .where(
      and(eq(queueEntries.genre, genre), eq(queueEntries.status, "scheduled")),
    );

  if (scheduled.length >= QUEUE_SIZE) return;

  const excludeIds = new Set<number>(scheduled.map((e) => e.songId));
  const lastServedId = await getLastServedSongId(genre);
  if (lastServedId !== null) excludeIds.add(lastServedId);

  const pool = await pickAutoDjCandidates(
    genre,
    excludeIds,
    QUEUE_SIZE - scheduled.length,
  );

  const [maxRow] = await db
    .select({ max: sql<number | null>`max(${queueEntries.position})` })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.genre, genre),
        eq(queueEntries.status, "scheduled"),
        eq(queueEntries.source, "autodj"),
      ),
    );
  let nextPosition = (maxRow?.max ?? -1) + 1;

  let added = 0;
  const needed = QUEUE_SIZE - scheduled.length;
  while (added < needed && pool.length > 0) {
    const song = weightedPickAndRemove(pool);
    if (!song) continue;

    if (!(await checkFileExists(song.path))) {
      console.warn(
        `[queue] Arquivo não encontrado: ${song.path} (songId=${song.id}) — removendo do banco`,
      );
      await removeMissingSong(song);
      continue;
    }

    await db.insert(queueEntries).values({
      genre,
      songId: song.id,
      status: "scheduled",
      source: "autodj",
      position: nextPosition++,
    });
    added++;

    // Evita que outra música do mesmo artista seja sorteada logo em seguida
    // dentro deste mesmo preenchimento — sem isso, duas músicas do mesmo
    // artista podiam ficar lado a lado na fila porque `blockedData.artists`
    // só reflete o estado ANTES deste loop começar, não os artistas já
    // escolhidos durante ele.
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i].artist === song.artist) pool.splice(i, 1);
    }
  }
}

/**
 * Reconstrói o bloco de pedidos "scheduled" da fila do "geral" a partir da
 * tabela `requests` (ordenada por `order`/`createdAt`), preservando os itens
 * AutoDJ já presentes (exceto duplicatas — pedido tem prioridade sobre
 * AutoDJ). Deve ser chamada após qualquer inserção/remoção/reordenação em
 * `requests`.
 */
export async function syncRequestsInQueue(genre: string): Promise<void> {
  if (genre !== "geral") return;

  // Tudo dentro de uma única transação: sem isso, leitores concorrentes
  // (getQueue/nextSongs/popNext) podiam ver a fila de pedidos momentaneamente
  // vazia entre o DELETE e os INSERTs, ou duplicada se duas chamadas
  // rodassem entrelaçadas — essa era a causa de pedidos "desaparecendo" e
  // músicas saindo de ordem.
  await db.transaction(async (tx) => {
    // Remove o bloco de pedidos "scheduled" anterior — será reconstruído.
    await tx
      .delete(queueEntries)
      .where(
        and(
          eq(queueEntries.genre, genre),
          eq(queueEntries.status, "scheduled"),
          eq(queueEntries.source, "request"),
        ),
      );

    const pending = await tx
      .select({
        requestId: requests.id,
        songId: songs.id,
        requestedAt: requests.createdAt,
      })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .orderBy(asc(requests.order), asc(requests.createdAt));

    if (pending.length === 0) return;

    // Pedidos sempre ocupam posições negativas — sempre antes de qualquer
    // linha "scheduled" do AutoDJ (posições >= 0).
    const total = pending.length;
    for (let i = 0; i < total; i++) {
      const r = pending[i];
      await tx.insert(queueEntries).values({
        genre,
        songId: r.songId,
        status: "scheduled",
        source: "request",
        requestId: r.requestId,
        requestedAt: r.requestedAt,
        position: -(total - i),
      });
    }

    // Pedido tem prioridade sobre AutoDJ: remove duplicatas AutoDJ "scheduled"
    // da mesma música.
    const requestSongIds = pending.map((p) => p.songId);
    await tx
      .delete(queueEntries)
      .where(
        and(
          eq(queueEntries.genre, genre),
          eq(queueEntries.status, "scheduled"),
          eq(queueEntries.source, "autodj"),
          inArray(queueEntries.songId, requestSongIds),
        ),
      );
  });
}

/**
 * Songid da última música servida (pending/current/played) deste gênero —
 * evita que o AutoDJ a sorteie de novo imediatamente.
 */
async function getLastServedSongId(genre: string): Promise<number | null> {
  const [last] = await db
    .select({ songId: queueEntries.songId })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.genre, genre),
        inArray(queueEntries.status, ["pending", "current", "played"]),
      ),
    )
    .orderBy(desc(queueEntries.id))
    .limit(1);

  return last?.songId ?? null;
}

/**
 * Confirma o início de reprodução (`on_track` do Liquidsoap, ou injeção
 * manual via admin): promove a linha "pending" correspondente para
 * "current" — ou cria uma linha "current" nova se não havia pending (ex.:
 * admin forçando tocar uma música fora da fila). Sempre rebaixa qualquer
 * linha "current" anterior do gênero para "played" antes de promover a
 * nova, garantindo no máximo uma "current" por gênero a qualquer momento.
 */
export async function setCurrent(params: {
  genre: string;
  songId: number;
  source?: "autodj" | "request" | "admin";
  wasRequestedFallback?: boolean;
}): Promise<ConfirmedCurrent | null> {
  const { genre, songId } = params;

  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);
  if (!song) return null;

  const result = await db.transaction(async (tx) => {
    const [pendingRow] = await tx
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.genre, genre),
          eq(queueEntries.status, "pending"),
          eq(queueEntries.songId, songId),
        ),
      )
      .orderBy(desc(queueEntries.id))
      .limit(1);

    // Rebaixa a "current" anterior ANTES de promover a nova — o índice
    // único parcial (genre, status='current') não permite duas ao mesmo tempo.
    await tx
      .update(queueEntries)
      .set({ status: "played", endedAt: new Date() })
      .where(
        and(eq(queueEntries.genre, genre), eq(queueEntries.status, "current")),
      );

    if (pendingRow) {
      await tx
        .update(queueEntries)
        .set({ status: "current", startedAt: new Date() })
        .where(eq(queueEntries.id, pendingRow.id));

      return {
        wasRequested: pendingRow.source === "request",
        requestedAt: pendingRow.requestedAt
          ? Number(pendingRow.requestedAt)
          : null,
      };
    }

    await tx.insert(queueEntries).values({
      genre,
      songId,
      status: "current",
      source: params.source ?? "admin",
      startedAt: new Date(),
    });

    return {
      wasRequested: params.wasRequestedFallback ?? false,
      requestedAt: null,
    };
  });

  return {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    path: song.path,
    cover: song.cover,
    genre: song.genre || "geral",
    allowedInGeneral: song.allowedInGeneral || 0,
    wasRequested: result.wasRequested,
    requestedAt: result.requestedAt,
  };
}

/**
 * Marca como "skipped" (nunca confirmada) qualquer linha "pending" órfã do
 * gênero — sobrou de uma seleção anterior cujo on_track nunca chegou antes
 * da próxima música ser selecionada. Equivalente ao "flush" do fluxo antigo
 * em memória, mas sem nunca virar "current" indevidamente.
 */
export async function flushStalePending(
  genre: string,
  exceptQueueEntryId: number,
): Promise<FlushedStale | null> {
  const [stale] = await db
    .select({
      queueEntryId: queueEntries.id,
      scheduledAt: queueEntries.scheduledAt,
      source: queueEntries.source,
      songId: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      genre: songs.genre,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.genre, genre),
        eq(queueEntries.status, "pending"),
        ne(queueEntries.id, exceptQueueEntryId),
      ),
    )
    .orderBy(desc(queueEntries.id))
    .limit(1);

  if (!stale) return null;

  await db
    .update(queueEntries)
    .set({ status: "skipped", endedAt: new Date() })
    .where(eq(queueEntries.id, stale.queueEntryId));

  return {
    songId: stale.songId,
    title: stale.title,
    artist: stale.artist,
    cover: stale.cover,
    genre,
    wasRequested: stale.source === "request",
    selectedAt: stale.scheduledAt
      ? new Date(stale.scheduledAt).getTime()
      : Date.now(),
  };
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
 * Aplica as proteções de repetição a um pool. As travas (música recente no
 * histórico, artista recente, `excludeIds`) NUNCA são ignoradas pelo
 * AutoDJ — só um admin tocando uma música manualmente (`/api/admin/play`)
 * pode pular essas proteções. Se o catálogo for pequeno demais para
 * respeitar as travas, o resultado é uma fila parcialmente preenchida (ver
 * `pickAutoDjCandidates`), nunca uma repetição silenciosa.
 */
function applyProtections(
  availableSongs: SongRow[],
  blockedData: { songIds: number[]; artists: string[] },
  excludeIds: Set<number>,
): SongRow[] {
  return availableSongs.filter((song) => {
    if (excludeIds.has(song.id)) return false;
    if (blockedData.songIds.includes(song.id)) return false;
    return !blockedData.artists.includes(song.artist);
  });
}

/**
 * Busca o pool de músicas disponíveis para o gênero SEM nunca relaxar as
 * proteções de repetição (música recente / artista recente). A única coisa
 * que se amplia quando o catálogo é pequeno demais é o filtro de horário
 * (timeSlot) e, por fim, cair para o pool do "geral" — nenhuma dessas duas
 * ampliações afeta a garantia de não-repetição.
 *
 * Se mesmo assim não houver candidatos suficientes para preencher `needed`
 * vagas, retorna o que for possível (a fila fica parcialmente preenchida) e
 * registra um aviso — sinal de que o catálogo do gênero precisa crescer.
 */
async function pickAutoDjCandidates(
  genre: string,
  excludeIds: Set<number>,
  needed: number,
): Promise<SongRow[]> {
  const tryGenre = async (g: string): Promise<SongRow[]> => {
    const inSlot = await fetchGenrePool(g, false);
    let pool = applyProtections(
      inSlot.availableSongs,
      inSlot.blockedData,
      excludeIds,
    );
    if (pool.length >= needed) return pool;

    const anySlot = await fetchGenrePool(g, true);
    const relaxedTimeSlot = applyProtections(
      anySlot.availableSongs,
      anySlot.blockedData,
      excludeIds,
    );
    if (relaxedTimeSlot.length > pool.length) pool = relaxedTimeSlot;

    return pool;
  };

  let pool = await tryGenre(genre);

  // Gêneros com poucas músicas (ex: 1 única em "modao") podem ficar sem
  // candidatos suficientes mesmo respeitando as travas — cai para o pool do
  // "geral" também (sem relaxar proteções).
  if (pool.length < needed && genre !== "geral") {
    const generalPool = await tryGenre("geral");
    if (generalPool.length > pool.length) pool = generalPool;
  }

  if (pool.length < needed) {
    console.warn(
      `[queue] [${genre}] Catálogo insuficiente para preencher a fila sem repetir música/artista recente ` +
        `(${pool.length}/${needed} candidatos disponíveis). A fila ficará parcialmente preenchida até o ` +
        `histórico liberar mais opções — considere adicionar mais músicas a este gênero.`,
    );
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
