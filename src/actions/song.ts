import { db } from "@/db";
import { songs, requests } from "@/db/schema";
import { or, like, sql } from "drizzle-orm";
import type { Song } from "@/types/song";

export async function SearchSongs(song: string): Promise<Song[]> {
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

export async function RequestSong(songId: number): Promise<{ success: boolean; message: string }> {
  try {
    await db.insert(requests).values({
      songId,
    });

    return {
      success: true,
      message: "Música adicionada à lista de pedidos com sucesso!"
    };
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return {
      success: false,
      message: "Erro ao adicionar música aos pedidos. Tente novamente."
    };
  }
}
