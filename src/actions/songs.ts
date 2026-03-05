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
  // Últimas 10 músicas do gênero especificado (padrão: "geral")
  const selectedGenre = genre || "geral";

  const query = db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      cover: songs.cover,
      playedAt: history.createdAt,
      genre: songs.genre,
      allowedInGeneral: songs.allowedInGeneral,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .orderBy(desc(history.id));

  const latest = await query.limit(100); // Pegar mais para filtrar

  // Filtrar por gênero
  let filtered = latest;
  if (selectedGenre === "geral") {
    // Geral: incluir músicas com genre='geral' OU allowedInGeneral=1
    filtered = latest.filter(
      (s) => s.genre === "geral" || s.allowedInGeneral === 1,
    );
  } else {
    // Outros gêneros: incluir apenas músicas do gênero específico
    filtered = latest.filter((s) => s.genre === selectedGenre);
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
  const selectedGenre = genre || "geral";

  // Apenas o gênero "geral" aceita pedidos
  let upcoming: Array<{
    reqId: number;
    id: number;
    title: string;
    artist: string;
    cover: string | null;
    requestedAt: Date | null;
  }> = [];

  if (selectedGenre === "geral") {
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

  // Sempre pegar próxima do AutoDJ para o gênero especificado
  // Isso mostra o que o AutoDJ tocaria se não houvesse pedidos
  const nextAutoDJ = await getNextSongToPlay(undefined, selectedGenre);

  const serialUpcoming = upcoming.map((u) => ({
    reqId: u.reqId,
    id: u.id,
    title: u.title,
    artist: u.artist,
    cover: u.cover || null,
    requestedAt: u.requestedAt ? Number(u.requestedAt) : null,
  }));

  const serialNext = nextAutoDJ
    ? {
        reqId: -1,
        id: nextAutoDJ.id,
        title: nextAutoDJ.title,
        artist: nextAutoDJ.artist,
        cover: nextAutoDJ.cover || null,
        requestedAt: nextAutoDJ.createdAt ? Number(nextAutoDJ.createdAt) : null,
      }
    : null;

  return { upcoming: serialUpcoming, nextIfNoRequests: serialNext };
}
