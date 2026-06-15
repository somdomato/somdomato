"use server";

import { db } from "@/db";
import { songs, history } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

  // Filtrar pelo gênero (mountpoint) onde a música foi TOCADA (history.genre)
  const latest = await db
    .select({
      historyId: history.id,
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      playedAt: history.createdAt,
      historyGenre: history.genre,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .where(eq(history.genre, selectedGenre))
    .orderBy(desc(history.id))
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
  // Top 10 músicas mais PEDIDAS (apenas wasRequested=1, não conta AutoDJ)
  const requestedHistory = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .where(eq(history.wasRequested, 1));

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

  const upcoming = getQueue(selectedGenre)
    .filter((e) => !isJingleMetadata({ title: e.title, artist: e.artist }))
    .slice(0, 10)
    .map((e) => ({
      reqId: e.source === "request" ? (e.requestId as number) : -e.id,
      id: e.id,
      title: e.title,
      artist: e.artist,
      cover: e.cover || null,
      requestedAt: e.requestedAt ?? null,
      source: e.source,
    }));

  return { upcoming, nextIfNoRequests: null };
}
