"use server";

import { db } from "@/db";
import { songs, queueEntries } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
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
  // Top 10 músicas mais PEDIDAS (apenas pedidos efetivamente tocados, não conta AutoDJ)
  const requestedHistory = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.source, "request"),
        eq(queueEntries.status, "played"),
      ),
    );

  const map = new Map<number, TopEntry>();
  for (const row of requestedHistory.filter(
    (entry) => !isJingleMetadata({ title: entry.title, artist: entry.artist }),
  )) {
    const entry = map.get(row.id);
    if (entry) entry.count += 1;
    else
      map.set(row.id, {
        id: row.id,
        title: row.title,
        artist: row.artist,
        cover: row.cover || null,
        count: 1,
      });
  }

  const top = Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return top.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    cover: t.cover || null,
    count: t.count,
  }));
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
