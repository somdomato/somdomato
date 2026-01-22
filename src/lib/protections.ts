import { db } from "@/db";
import { requests, songs, history } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface RepetitionCheckResult {
  isRepeated: boolean;
  reason?: "song_in_history" | "song_in_requests" | "artist_recent";
  message?: string;
}

export async function checkMusicRepetition(songId: number): Promise<RepetitionCheckResult> {
  // Verificar se a música existe
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);

  if (!song) {
    return {
      isRepeated: true,
      reason: "song_in_history", // Usar como fallback
      message: "Música não encontrada",
    };
  }

  // 1. Verificar se a música está nas últimas 100 do histórico
  const last100Songs = await db.select({ songId: history.songId }).from(history).orderBy(desc(history.id)).limit(100);

  const last100SongIds = last100Songs.map((h) => h.songId);

  if (last100SongIds.includes(songId)) {
    return {
      isRepeated: true,
      reason: "song_in_history",
      message: `A música "${song.title}" já foi tocada nas últimas 100 músicas.`,
    };
  }

  // 2. Verificar se a música já está nos pedidos pendentes
  const existingRequest = await db.select().from(requests).where(eq(requests.songId, songId)).limit(1);

  if (existingRequest.length > 0) {
    return {
      isRepeated: true,
      reason: "song_in_requests",
      message: `A música "${song.title}" já está na fila de pedidos.`,
    };
  }

  // 3. Verificar repetição de artista: últimas 10 músicas do histórico
  const recentHistory = await db
    .select({
      artist: songs.artist,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .orderBy(desc(history.id))
    .limit(10);

  // 4. Verificar artistas dos pedidos pendentes
  const pendingArtists = await db
    .select({
      artist: songs.artist,
    })
    .from(requests)
    .innerJoin(songs, eq(requests.songId, songs.id));

  const recentArtists = [...recentHistory.map((h) => h.artist), ...pendingArtists.map((p) => p.artist)];

  if (recentArtists.includes(song.artist)) {
    return {
      isRepeated: true,
      reason: "artist_recent",
      message: `O artista "${song.artist}" tocou recentemente ou já está nos pedidos pendentes.`,
    };
  }

  return { isRepeated: false };
}

/**
 * Obtém IDs de músicas que devem ser bloqueadas (histórico + requests pendentes)
 */
export async function getBlockedSongIds(): Promise<{
  songIds: number[];
  artists: string[];
}> {
  // Histórico das últimas 100 músicas
  const last100Songs = await db.select({ songId: history.songId }).from(history).orderBy(desc(history.id)).limit(100);

  // Requests pendentes
  const pendingRequests = await db.select({ songId: requests.songId }).from(requests);

  // Artistas das últimas 10 músicas do histórico
  const recentHistory = await db
    .select({
      artist: songs.artist,
    })
    .from(history)
    .innerJoin(songs, eq(history.songId, songs.id))
    .orderBy(desc(history.id))
    .limit(10);

  // Artistas dos requests pendentes
  const pendingArtists = await db
    .select({
      artist: songs.artist,
    })
    .from(requests)
    .innerJoin(songs, eq(requests.songId, songs.id));

  return {
    songIds: [...last100Songs.map((h) => h.songId), ...pendingRequests.map((r) => r.songId)],
    artists: [...recentHistory.map((h) => h.artist), ...pendingArtists.map((p) => p.artist)],
  };
}
