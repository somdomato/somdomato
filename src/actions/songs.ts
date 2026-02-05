"use server";

import { db } from "@/db";
import { songs, requests, history } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getNextSongToPlay } from "@/lib/rotation";

type TopEntry = {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  count: number;
};

export async function lastSongs(genre?: string) {
  // Últimas 10 músicas do gênero especificado
  const query = db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      playedAt: history.createdAt,
      genre: songs.genre,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .orderBy(desc(history.id));

  const latest = await query.limit(100); // Pegar mais para filtrar

  // Filtrar por gênero se especificado
  let filtered = latest;
  if (genre && genre !== "geral") {
    filtered = latest.filter((s) => s.genre === genre);
  }

  return filtered.slice(0, 10).map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    cover: s.cover || null,
    playedAt: s.playedAt ? Number(s.playedAt) : null,
  }));
}

export async function topSongs() {
  // Top 10 (agregação em memória a partir do histórico)
  const allHistory = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id));

  const map = new Map<number, TopEntry>();
  for (const row of allHistory) {
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
  // Apenas o gênero "geral" aceita pedidos
  let upcoming: Array<{
    reqId: number;
    id: number;
    title: string;
    artist: string;
    cover: string | null;
    requestedAt: Date | null;
  }> = [];

  if (!genre || genre === "geral") {
    // Próximas: pedidos pendentes (apenas para geral)
    upcoming = await db
      .select({
        reqId: requests.id,
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        cover: songs.cover,
        requestedAt: requests.createdAt,
      })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .orderBy(asc(requests.order), asc(requests.createdAt))
      .limit(10);
  }

  // Se não há pedidos (ou não é geral), pegar próxima do AutoDJ do gênero especificado
  const nextIfNoRequests =
    upcoming.length === 0 ? await getNextSongToPlay(undefined, genre) : null;

  const serialUpcoming = upcoming.map((u) => ({
    reqId: u.reqId,
    id: u.id,
    title: u.title,
    artist: u.artist,
    cover: u.cover || null,
    requestedAt: u.requestedAt ? Number(u.requestedAt) : null,
  }));

  const serialNext = nextIfNoRequests
    ? {
        reqId: -1,
        id: nextIfNoRequests.id,
        title: nextIfNoRequests.title,
        artist: nextIfNoRequests.artist,
        cover: nextIfNoRequests.cover || null,
        requestedAt: nextIfNoRequests.createdAt
          ? Number(nextIfNoRequests.createdAt)
          : null,
      }
    : null;

  return { upcoming: serialUpcoming, nextIfNoRequests: serialNext };
}
