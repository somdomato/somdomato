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
  letter?: string; // filtra pela primeira letra do artista
}

import { normalizeString } from "@/db/utils";

export async function searchSongs({
  query = "",
  page = 1,
  limit = 10,
  letter = "",
}: SearchSongsParams) {
  const offset = (page - 1) * limit;

  const hasQuery = query.trim() !== "";
  const hasLetter = letter.trim() !== "";

  if (hasQuery || hasLetter) {
    const rows = await db.select().from(songs).orderBy(songs.artist);

    let filtered = rows;

    if (hasLetter) {
      const letterNorm = normalizeString(letter.trim())[0] ?? "";
      filtered = filtered.filter((s) =>
        normalizeString(s.artist).startsWith(letterNorm),
      );
    }

    if (hasQuery) {
      const qn = normalizeString(query);
      filtered = filtered.filter((s) => {
        const title = normalizeString(s.title);
        const artist = normalizeString(s.artist);
        const p = normalizeString(s.path || "");
        return title.includes(qn) || artist.includes(qn) || p.includes(qn);
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { songs: paginated, total, pages: Math.ceil(total / limit) };
  }

  // Sem filtro: não retornar nada (modal começa vazio)
  return { songs: [], total: 0, pages: 0 };
}

export async function requestSong(songId: number) {
  try {
    // Verificar se a música existe
    const song = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .get();

    if (!song) {
      return { success: false, message: "Música não encontrada" };
    }

    // Verificar repetições usando o sistema de proteções
    const check = await checkMusicRepetition(songId);

    if (check.isRepeated) {
      return {
        success: false,
        message: check.message || "Esta música não pode ser pedida agora",
      };
    }

    // Pegar a última ordem
    const lastRequest = await db
      .select()
      .from(requests)
      .orderBy(desc(requests.order))
      .limit(1)
      .get();

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
      const g = global as unknown as {
        io?: { emit: (event: string, payload?: unknown) => void };
      };
      if (typeof global !== "undefined" && g.io && created) {
        // Converter requestedAt para número para evitar problemas de serialização
        const payload = {
          ...created,
          requestedAt: created.requestedAt ? Number(created.requestedAt) : null,
        };
        g.io.emit("request:added", payload);
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
