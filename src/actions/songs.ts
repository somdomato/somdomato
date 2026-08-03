"use server";

import { db } from "@/db";
import { songs, queueEntries } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { ensureQueue, getQueue } from "@/lib/queue";
import { isJingleMetadata } from "@/lib/song-visibility";

type TopEntry = {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  count: number;
};

export async function lastSongs(genre?: string) {
  // Últimas 10 músicas do mountpoint especificado (padrão: "geral")
  const selectedGenre = genre || "geral";

  // status="played" exclui por construção a música "current" (status
  // diferente) — não precisa de filtro manual para não mostrar a atual aqui.
  const latest = await db
    .select({
      historyId: queueEntries.id,
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      playedAt: queueEntries.endedAt,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.genre, selectedGenre),
        eq(queueEntries.status, "played"),
      ),
    )
    .orderBy(desc(queueEntries.id))
    .limit(30);

  return latest
    .filter((s) => !isJingleMetadata({ title: s.title, artist: s.artist }))
    .slice(0, 10)
    .map((s) => ({
      historyId: s.historyId,
      id: s.id,
      title: s.title,
      artist: s.artist,
      cover: s.cover || null,
      playedAt: s.playedAt ? Number(s.playedAt) : null,
    }));
}

export async function topSongs() {
  // Top 10 músicas mais PEDIDAS (apenas pedidos efetivamente tocados, não conta AutoDJ).
  // Agregado em SQL (uma linha por música) em vez de trazer toda a tabela de
  // histórico para agregar em JS — a query antiga crescia com o histórico total.
  const requestCounts = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.source, "request"),
        eq(queueEntries.status, "played"),
      ),
    )
    .groupBy(songs.id, songs.title, songs.artist, songs.cover)
    .orderBy(desc(sql`count(*)`))
    .limit(50); // margem para descontar vinhetas antes de cortar para 10

  const top: TopEntry[] = requestCounts
    .filter((row) => !isJingleMetadata({ title: row.title, artist: row.artist }))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      cover: row.cover || null,
      count: row.count,
    }));

  return top;
}
export async function nextSongs(genre?: string) {
  const selectedGenre = genre || "geral";

  await ensureQueue(selectedGenre);

  // getQueue já inclui a música "pending" (servida ao Liquidsoap, aguardando
  // confirmação via on_track) na primeira posição — ela só vira "current"
  // (e some daqui) quando o on_track de fato confirmar.
  const raw = (await getQueue(selectedGenre))
    .filter((e) => !isJingleMetadata({ title: e.title, artist: e.artist }))
    .map((e) => ({
      reqId: e.source === "request" ? (e.requestId as number) : null,
      id: e.id,
      title: e.title,
      artist: e.artist,
      cover: e.cover || null,
      requestedAt: e.requestedAt ?? null,
      source: e.source,
    }));

  // Assign unique reqIds: real requestId for request entries, position-based
  // negative index for autodj (song ids repeat, position does not).
  const upcoming = raw.slice(0, 10).map((e, i) => ({
    ...e,
    reqId: e.reqId ?? -(i + 1),
  }));

  return { upcoming, nextIfNoRequests: null };
}
