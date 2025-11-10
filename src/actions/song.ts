"use server";

import { db } from "@/db";
import { songs, requests, history } from "@/db/schema";
import { eq, or, like, sql } from "drizzle-orm";
import type { SongData } from "@/types/song";
import { checkMusicRepetition } from "@/lib/protections";

export async function SearchSongs(song: string): Promise<SongData[]> {
  if (!song) return [];

  const searchTerm = `%${song}%`;

  const result = await db
    .select()
    .from(songs)
    .where(
      or(
        like(sql`LOWER(${songs.title})`, searchTerm.toLowerCase()),
        like(sql`LOWER(${songs.artist})`, searchTerm.toLowerCase()),
      ),
    )
    .orderBy(songs.title)
    .limit(20);

  return result;
}

export async function RequestSong(
  songId: number,
): Promise<{ success: boolean; message: string }> {
  const repetitionCheck = await checkMusicRepetition(songId);

  if (repetitionCheck.isRepeated) {
    switch (repetitionCheck.reason) {
      case "song_in_history":
        return {
          success: false,
          message: "Música já tocou recentemente",
        };
      case "song_in_requests":
        return {
          success: false,
          message: "Música já está nos pedidos",
        };
      case "artist_recent":
        return {
          success: false,
          message: "Artista tocou recentemente",
        };
      default:
        return {
          success: false,
          message: "Música não pode ser adicionada aos pedidos.",
        };
    }
  }

  try {
    await db.insert(requests).values({ songId });

    return {
      success: true,
      message: "Música adicionada à lista de pedidos com sucesso!",
    };
  } catch {
    return {
      success: false,
      message: "Erro ao adicionar música aos pedidos. Tente novamente.",
    };
  }
}

export async function getRequests() {
  return await db
    .select()
    .from(requests)
    .leftJoin(songs, eq(requests.id, songs.id))
    .orderBy(requests.id)
    .limit(20);
}

export async function getHistory() {
  return await db
    .select()
    .from(history)
    .leftJoin(songs, eq(history.id, songs.id))
    .orderBy(history.id)
    .limit(20);
}
