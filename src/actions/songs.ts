"use server";

import { db } from "@/db";
import { songs, requests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { checkMusicRepetition } from "@/lib/protections";
import { revalidatePath } from "next/cache";

interface SearchSongsParams {
  query?: string;
  page?: number;
  limit?: number;
}

import { normalizeString } from "@/db/utils";

export async function searchSongs({ query = "", page = 1, limit = 10 }: SearchSongsParams) {
  const offset = (page - 1) * limit;

  // Se houver query de busca, normaliza e filtra sem acentos/caixa
  if (query && query.trim() !== "") {
    const qn = normalizeString(query);

    // Buscar todos (small DB expected) e filtrar em JS usando normalizeString
    const rows = await db.select().from(songs).orderBy(songs.title);

    const filtered = rows.filter((s) => {
      const title = normalizeString(s.title);
      const artist = normalizeString(s.artist);
      const path = normalizeString(s.path || "");
      return title.includes(qn) || artist.includes(qn) || path.includes(qn);
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      songs: paginated,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // Sem query: comportamento paginado normal
  const allSongs = await db.select().from(songs).limit(limit).offset(offset).orderBy(songs.title);
  const [{ count }] = await db
    .select({ count: songs.id })
    .from(songs)
    .execute()
    .then((rows) => [{ count: rows.length }]);

  return {
    songs: allSongs,
    total: count,
    pages: Math.ceil(count / limit),
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

    // Buscar o pedido criado (join com songs) para emitir via socket
    const created = await db
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
      .where(eq(requests.order, newOrder))
      .limit(1)
      .get();

    // Emitir evento para clientes em tempo real (se disponível)
    try {
      const g = global as unknown as { io?: { emit: (event: string, payload?: unknown) => void } };
      if (typeof global !== "undefined" && g.io && created) {
        g.io.emit("request:added", created);
      }
    } catch (e) {
      // não crítico — falhar ao emitir não deve quebrar a ação
      console.warn("Falha ao emitir request:added", e);
    }

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
