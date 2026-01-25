"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { songs, requests } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import NodeID3 from "node-id3";
import { normalizeString } from "@/db/utils";

// Tipos
export type RotationType = "inativo" | "leve" | "normal" | "pesado";

// Verificação de autenticação
async function verifyAuth(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD não está configurada");
    throw new Error("Configuração de admin ausente");
  }
  if (password !== adminPassword) {
    throw new Error("Senha inválida");
  }
} 

// ===== ACTIONS DE MÚSICAS =====

export async function getSongs(page = 1, limit = 10, password: string, query = "") {
  await verifyAuth(password);

  const offset = (page - 1) * limit;

  // Se houver query de busca, normaliza e filtra
  if (query && query.trim() !== "") {
    const qn = normalizeString(query);

    // Buscar todos e filtrar em JS usando normalizeString
    const rows = await db.select().from(songs).orderBy(asc(songs.title));

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
  const allSongs = await db.select().from(songs).limit(limit).offset(offset).orderBy(asc(songs.title));

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

export async function updateSong(
  id: number,
  data: {
    filename?: string;
    title?: string;
    artist?: string;
    album?: string;
    rotation?: RotationType;
    timeSlots?: number;
    coverFile?: string; // Base64 da imagem da capa
  },
  password: string,
) {
  await verifyAuth(password);

  const song = await db.select().from(songs).where(eq(songs.id, id)).get();
  if (!song) throw new Error("Música não encontrada");

  let currentPath = song.path;
  let newPath = song.path;

  // Se o nome do arquivo mudou, renomear o arquivo físico
  const currentFilename = path.basename(song.path);
  if (data.filename && data.filename !== currentFilename) {
    const oldPath = song.path;
    const dir = path.dirname(oldPath);
    newPath = path.join(dir, data.filename);

    try {
      await fs.rename(oldPath, newPath);
      currentPath = newPath;
      data.filename = newPath; // Atualizar caminho no banco
    } catch (error) {
      console.error("Erro ao renomear arquivo:", error);
      throw new Error(`Erro ao renomear arquivo: ${error instanceof Error ? error.message : "desconhecido"}`);
    }
  } else {
    // Se não está renomeando, não atualizar o path no banco
    data.filename = undefined;
  }

  // Atualizar tags ID3 (usar o path atual, que pode ser o novo se foi renomeado)
  if (data.title || data.artist || data.album || data.coverFile) {
    const tags: NodeID3.Tags = {};
    if (data.title) tags.title = data.title;
    if (data.artist) tags.artist = data.artist;
    if (data.album) tags.album = data.album;

    // Se foi fornecida uma capa em base64, adicionar à tag ID3
    if (data.coverFile) {
      try {
        // Converter base64 para buffer
        const base64Data = data.coverFile.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        tags.image = {
          mime: "image/jpeg",
          type: {
            id: 3,
            name: "front cover",
          },
          description: "Cover",
          imageBuffer: imageBuffer,
        };
      } catch (error) {
        console.error("Erro ao processar imagem da capa:", error);
      }
    }

    const success = NodeID3.update(tags, currentPath);
    if (!success) {
      console.error("Erro ao atualizar tags ID3");
    }
  }

  // Atualizar banco de dados
  await db
    .update(songs)
    .set({
      ...(data.filename && { path: data.filename }),
      ...(data.title && { title: data.title }),
      ...(data.artist && { artist: data.artist }),
      ...(data.album && { album: data.album }),
      ...(data.rotation && { rotation: data.rotation }),
      ...(data.timeSlots !== undefined && { timeSlots: data.timeSlots }),
    })
    .where(eq(songs.id, id));

  // Tentar extrair/salvar capa do arquivo (ou procurar por capa existente por artista)
  try {
    const { extractAndSaveCover, findCoverByArtist } = await import("@/lib/cover");
    // currentPath aponta para o caminho atual do arquivo (pode ter sido renomeado)
    const coverPath = await extractAndSaveCover(currentPath);
    if (coverPath) {
      await db.update(songs).set({ cover: coverPath }).where(eq(songs.id, id));
    } else if (data.artist) {
      const found = await findCoverByArtist(data.artist);
      if (found) {
        await db.update(songs).set({ cover: found }).where(eq(songs.id, id));
      }
    }
  } catch (error) {
    console.error("Erro ao processar capa da música:", error);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteSong(id: number, password: string) {
  await verifyAuth(password);

  const song = await db.select().from(songs).where(eq(songs.id, id)).get();
  if (!song) throw new Error("Música não encontrada");

  // Deletar arquivo físico (opcional - comente se não quiser deletar)
  try {
    await fs.unlink(song.path);
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
  }

  // Deletar do banco
  await db.delete(songs).where(eq(songs.id, id));

  revalidatePath("/admin");
  return { success: true };
}

// ===== ACTIONS DE PEDIDOS =====

export async function getRequests(page = 1, limit = 10, password: string) {
  await verifyAuth(password);

  const offset = (page - 1) * limit;
  const allRequests = await db
    .select({
      id: requests.id,
      order: requests.order,
      createdAt: requests.createdAt,
      song: songs,
    })
    .from(requests)
    .leftJoin(songs, eq(requests.songId, songs.id))
    .limit(limit)
    .offset(offset)
    .orderBy(asc(requests.order));

  const [{ count }] = await db
    .select({ count: requests.id })
    .from(requests)
    .execute()
    .then((rows) => [{ count: rows.length }]);

  return {
    requests: allRequests,
    total: count,
    pages: Math.ceil(count / limit),
  };
}

export async function addRequest(songId: number, password: string) {
  await verifyAuth(password);

  // Pegar a última ordem
  const lastRequest = await db.select().from(requests).orderBy(desc(requests.order)).limit(1).get();

  const newOrder = lastRequest ? lastRequest.order + 1 : 1;

  await db.insert(requests).values({
    songId,
    order: newOrder,
  });

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function deleteRequest(id: number, password: string) {
  await verifyAuth(password);

  await db.delete(requests).where(eq(requests.id, id));

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function reorderRequests(requestId: number, newOrder: number, password: string) {
  await verifyAuth(password);

  const request = await db.select().from(requests).where(eq(requests.id, requestId)).get();

  if (!request) throw new Error("Pedido não encontrado");

  const oldOrder = request.order;

  if (oldOrder === newOrder) return { success: true };

  // Ajustar outras ordens
  if (newOrder > oldOrder) {
    // Movendo para baixo
    await db.update(requests).set({ order: oldOrder }).where(eq(requests.order, newOrder));
  } else {
    // Movendo para cima
    await db.update(requests).set({ order: oldOrder }).where(eq(requests.order, newOrder));
  }

  // Atualizar a ordem do pedido
  await db.update(requests).set({ order: newOrder }).where(eq(requests.id, requestId));

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function getAllSongsForSelect(password: string) {
  await verifyAuth(password);

  return await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
    })
    .from(songs)
    .orderBy(asc(songs.title));
}
