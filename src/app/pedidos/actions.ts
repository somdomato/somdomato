"use server";

import { db } from "@/db";
import { songs, requests } from "@/db/schema";
import { eq, desc, like, or } from "drizzle-orm";
import { checkMusicRepetition } from "@/lib/protections";
import { revalidatePath } from "next/cache";

interface SearchSongsParams {
  query?: string;
  page?: number;
  limit?: number;
}

export async function searchSongs({ query = "", page = 1, limit = 10 }: SearchSongsParams) {
  const offset = (page - 1) * limit;

  // Se houver query de busca, filtrar por artista, título ou path
  const allSongs =
    query && query.trim() !== ""
      ? await db
          .select()
          .from(songs)
          .where(or(like(songs.artist, `%${query}%`), like(songs.title, `%${query}%`), like(songs.path, `%${query}%`)))
          .limit(limit)
          .offset(offset)
          .orderBy(songs.title)
      : await db.select().from(songs).limit(limit).offset(offset).orderBy(songs.title);

  // Contar total de registros
  const countResult =
    query && query.trim() !== ""
      ? await db
          .select()
          .from(songs)
          .where(or(like(songs.artist, `%${query}%`), like(songs.title, `%${query}%`), like(songs.path, `%${query}%`)))
      : await db.select().from(songs);

  const total = countResult.length;

  return {
    songs: allSongs,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function requestSong(songId: number) {
  try {
    // Verificar se a música existe
    const song = await db.select().from(songs).where(eq(songs.id, songId)).get();

    if (!song) {
      return { success: false, message: "Música não encontrada" };
    }

    // Verificar repetições usando o sistema de proteções
    const check = await checkMusicRepetition(songId);

    if (check.isRepeated) {
      return { success: false, message: check.message || "Esta música não pode ser pedida agora" };
    }

    // Pegar a última ordem
    const lastRequest = await db.select().from(requests).orderBy(desc(requests.order)).limit(1).get();

    const newOrder = lastRequest ? lastRequest.order + 1 : 1;

    // Adicionar pedido
    await db.insert(requests).values({
      songId,
      order: newOrder,
    });

    // Incrementar contador de requests da música
    await db
      .update(songs)
      .set({ requests: (song.requests || 0) + 1 })
      .where(eq(songs.id, songId));

    revalidatePath("/pedidos");

    return {
      success: true,
      message: `"${song.title}" foi adicionada à fila!`,
    };
  } catch (error) {
    console.error("Erro ao fazer pedido:", error);
    return {
      success: false,
      message: "Erro ao fazer pedido. Tente novamente.",
    };
  }
}
