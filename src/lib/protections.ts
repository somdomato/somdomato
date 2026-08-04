import { db } from "@/db";
import { songs, queueEntries } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { LAST_SONGS_HISTORY_LIMIT } from "@/config";

const QUEUED_STATUSES = ["scheduled", "pending", "current"] as const;

export interface RepetitionCheckResult {
  isRepeated: boolean;
  reason?: "song_in_history" | "song_in_requests" | "artist_recent";
  message?: string;
}

export async function checkMusicRepetition(
  songId: number,
): Promise<RepetitionCheckResult> {
  // Verificar se a música existe
  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song) {
    return {
      isRepeated: true,
      reason: "song_in_history", // Usar como fallback
      message: "Música não encontrada",
    };
  }

  // 1. Verificar se a música está nas últimas N do histórico do geral
  // (pedidos só tocam no mountpoint "geral", então filtramos por ele)
  const lastSongs = await db
    .select({ songId: queueEntries.songId })
    .from(queueEntries)
    .where(
      and(eq(queueEntries.genre, "geral"), eq(queueEntries.status, "played")),
    )
    .orderBy(desc(queueEntries.id))
    .limit(LAST_SONGS_HISTORY_LIMIT);
  const lastSongIds = lastSongs.map((h) => h.songId);

  if (lastSongIds.includes(songId)) {
    return {
      isRepeated: true,
      reason: "song_in_history",
      message: `A música "${song.title}" já foi tocada nas últimas ${LAST_SONGS_HISTORY_LIMIT} músicas.`,
    };
  }

  // 2. Verificar se a música já está na fila (Próximas: agendada, pendente ou tocando agora)
  const existingInQueue = await db
    .select()
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.genre, "geral"),
        eq(queueEntries.songId, songId),
        inArray(queueEntries.status, QUEUED_STATUSES),
      ),
    )
    .limit(1);
  if (existingInQueue.length > 0) {
    return {
      isRepeated: true,
      reason: "song_in_requests",
      message: `A música "${song.title}" já está na fila.`,
    };
  }

  // 3. Verificar repetição de artista: últimas 10 músicas do histórico do geral
  const recentHistory = await db
    .select({
      artist: songs.artist,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(eq(queueEntries.genre, "geral"), eq(queueEntries.status, "played")),
    )
    .orderBy(desc(queueEntries.id))
    .limit(10);

  // 4. Verificar artistas já na fila (Próximas)
  const queuedArtists = await db
    .select({
      artist: songs.artist,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.genre, "geral"),
        inArray(queueEntries.status, QUEUED_STATUSES),
      ),
    );

  const recentArtists = [
    ...recentHistory.map((h) => h.artist),
    ...queuedArtists.map((p) => p.artist),
  ];
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
 * Filtra por gênero para que cada mountpoint tenha seu próprio cooldown
 */
export async function getBlockedSongIds(genre: string = "geral"): Promise<{
  songIds: number[];
  artists: string[];
}> {
  // Histórico das últimas N músicas DESTE GÊNERO
  const lastSongs = await db
    .select({ songId: queueEntries.songId })
    .from(queueEntries)
    .where(
      and(eq(queueEntries.genre, genre), eq(queueEntries.status, "played")),
    )
    .orderBy(desc(queueEntries.id))
    .limit(LAST_SONGS_HISTORY_LIMIT);

  // Músicas já na fila (Próximas: agendada, pendente ou tocando agora) DESTE GÊNERO
  const queuedSongs = await db
    .select({ songId: queueEntries.songId })
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.genre, genre),
        inArray(queueEntries.status, QUEUED_STATUSES),
      ),
    );

  // Artistas das últimas 10 músicas do histórico DESTE GÊNERO
  const recentHistory = await db
    .select({
      artist: songs.artist,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(eq(queueEntries.genre, genre), eq(queueEntries.status, "played")),
    )
    .orderBy(desc(queueEntries.id))
    .limit(10);

  // Artistas já na fila (Próximas) DESTE GÊNERO
  const queuedArtists = await db
    .select({
      artist: songs.artist,
    })
    .from(queueEntries)
    .innerJoin(songs, eq(queueEntries.songId, songs.id))
    .where(
      and(
        eq(queueEntries.genre, genre),
        inArray(queueEntries.status, QUEUED_STATUSES),
      ),
    );

  return {
    songIds: [
      ...lastSongs.map((h) => h.songId),
      ...queuedSongs.map((r) => r.songId),
    ],
    artists: [
      ...recentHistory.map((h) => h.artist),
      ...queuedArtists.map((p) => p.artist),
    ],
  };
}
