"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { songs, requests, history, likes } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import NodeID3 from "node-id3";
import { normalizeString } from "@/db/utils";

// Tipos
export type RotationType = "inativo" | "leve" | "normal" | "pesado";
export type Genre =
  | "geral"
  | "gaucha"
  | "modao"
  | "arrocha"
  | "romantico"
  | "forro";

// Verificação de autenticação via cookie
async function verifyAuth() {
  const { cookies } = await import("next/headers");
  const { getUserFromSession } = await import("@/lib/session");
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);

  if (!session || session.role !== "admin") {
    throw new Error("Não autorizado");
  }
}

// ===== ACTIONS DE MÚSICAS =====

export async function getSongs(
  page = 1,
  limit = 10,
  query = "",
  genre?: Genre,
) {
  await verifyAuth();

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
      const matchesQuery =
        title.includes(qn) || artist.includes(qn) || path.includes(qn);
      const matchesGenre = !genre || s.genre === genre;
      return matchesQuery && matchesGenre;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      songs: paginated,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // Sem query: comportamento paginado normal (com filtro de gênero opcional)
  let query_builder = db.select().from(songs);

  if (genre) {
    query_builder = query_builder.where(
      eq(songs.genre, genre),
    ) as typeof query_builder;
  }

  const allSongs = await query_builder
    .limit(limit)
    .offset(offset)
    .orderBy(asc(songs.title));

  // Contar total de músicas (com filtro de gênero)
  let totalQuery = db.select().from(songs);
  if (genre) {
    totalQuery = totalQuery.where(eq(songs.genre, genre)) as typeof totalQuery;
  }
  const totalRows = await totalQuery.all();
  const total = totalRows.length;

  return {
    songs: allSongs,
    total,
    pages: Math.ceil(total / limit),
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
    genre?: Genre;
    allowedInGeneral?: boolean;
    coverFile?: string; // Base64 da imagem da capa
    resetCover?: boolean; // Se true, reseta a capa para o padrão
  },
) {
  await verifyAuth();

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
      throw new Error(
        `Erro ao renomear arquivo: ${error instanceof Error ? error.message : "desconhecido"}`,
      );
    }
  } else {
    // Se não está renomeando, não atualizar o path no banco
    data.filename = undefined;
  }

  // Atualizar tags ID3 (usar o path atual, que pode ser o novo se foi renomeado)
  if (data.title || data.artist || data.album || data.genre || data.coverFile) {
    const tags: NodeID3.Tags = {};
    if (data.title) tags.title = data.title;
    if (data.artist) tags.artist = data.artist;
    if (data.album) tags.album = data.album;

    // Sincronizar gênero com ID3 tags
    // Importante: "geral" no banco deve ser "Sertanejo" no ID3
    if (data.genre) {
      const genreToId3: Record<Genre, string> = {
        geral: "Sertanejo",
        gaucha: "Sertanejo Gaúcho",
        modao: "Modão",
        arrocha: "Arrocha",
        romantico: "Romântico",
        forro: "Forró",
      };
      tags.genre = genreToId3[data.genre];
    }

    // Se foi fornecida uma capa em base64, adicionar à tag ID3
    if (data.coverFile) {
      try {
        // Converter base64 para buffer
        const base64Data = data.coverFile.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
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

  // Atualizar banco de dados (montar objeto dinamicamente e evitar set vazio)
  const updateFields: Record<string, unknown> = {
    ...(data.filename && { path: data.filename }),
    ...(data.title && { title: data.title }),
    ...(data.artist && { artist: data.artist }),
    ...(data.album && { album: data.album }),
    ...(data.rotation && { rotation: data.rotation }),
    ...(data.timeSlots !== undefined && { timeSlots: data.timeSlots }),
    ...(data.genre && { genre: data.genre }),
    ...(data.allowedInGeneral !== undefined && {
      allowedInGeneral: data.allowedInGeneral ? 1 : 0,
    }),
  };

  // Se solicitarem reset da capa, incluir no objeto de atualização para evitar set vazio
  if (data.resetCover) {
    updateFields.cover = "/images/logotipo.svg";
  }

  if (Object.keys(updateFields).length > 0) {
    await db.update(songs).set(updateFields).where(eq(songs.id, id));
  }

  // Processar capa
  try {
    if (data.resetCover) {
      // Garantir DB com capa padrão (já setado acima, mas confirmar)
      await db
        .update(songs)
        .set({ cover: "/images/logotipo.svg" })
        .where(eq(songs.id, id));

      // Remover imagem embutida no ID3 para que o pipeline de auto-extração
      // possa buscar uma nova capa na próxima execução
      await new Promise<void>((resolve) => {
        NodeID3.read(currentPath, (err: Error | null, tags: NodeID3.Tags) => {
          if (err || !tags?.image) return resolve();
          try {
            NodeID3.removeTags(currentPath);
            const tagsToWrite: NodeID3.Tags = {
              title: (data.title as string) ?? song.title,
              artist: (data.artist as string) ?? song.artist,
            };
            const album = (data.album as string) ?? song.album;
            if (album) tagsToWrite.album = album;
            NodeID3.update(tagsToWrite, currentPath);
          } catch (e) {
            console.error("[cover] Erro ao remover imagem ID3:", e);
          }
          resolve();
        });
      });

      // Remover o arquivo de capa do disco para permitir re-fetch limpo
      const { deleteArtistCover } = await import("@/lib/cover");
      const artistName = (data.artist as string) ?? song.artist;
      await deleteArtistCover(artistName);
    } else {
      const { extractAndSaveCover, checkExistingCover } = await import(
        "@/lib/cover"
      );

      const artistName = (data.artist as string) ?? song.artist;

      // Tentar extrair do ID3 (que pode ter sido atualizado com coverFile acima)
      const fromId3 = await extractAndSaveCover(currentPath, artistName).catch(
        () => null,
      );

      if (fromId3) {
        await db.update(songs).set({ cover: fromId3 }).where(eq(songs.id, id));
      } else {
        // Verificar se já existe arquivo de capa no disco para este artista
        const existing = await checkExistingCover(artistName);
        if (existing) {
          await db
            .update(songs)
            .set({ cover: existing })
            .where(eq(songs.id, id));
        }
      }
    }
  } catch (error) {
    console.error("[cover] Erro ao processar capa da música:", error);
  }

  revalidatePath("/admin");

  // Retornar a música atualizada para que o cliente possa sincronizar imediatamente
  const updated = await db.select().from(songs).where(eq(songs.id, id)).get();
  return { success: true, song: updated };
}

export async function deleteSong(id: number) {
  await verifyAuth();

  const song = await db.select().from(songs).where(eq(songs.id, id)).get();
  if (!song) throw new Error("Música não encontrada");

  // Deletar arquivo físico (opcional - comente se não quiser deletar)
  try {
    await fs.unlink(song.path);
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
  }

  // Deletar registros relacionados antes de deletar a música (devido às foreign keys)
  await db.delete(requests).where(eq(requests.songId, id));
  await db.delete(history).where(eq(history.songId, id));
  await db.delete(likes).where(eq(likes.songId, id));

  // Deletar do banco
  await db.delete(songs).where(eq(songs.id, id));

  revalidatePath("/admin");
  return { success: true };
}

// ===== ACTIONS DE PEDIDOS =====

export async function getRequests(page = 1, limit = 10) {
  await verifyAuth();

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

export async function addRequest(songId: number) {
  await verifyAuth();

  // Pegar a última ordem
  const lastRequest = await db
    .select()
    .from(requests)
    .orderBy(desc(requests.order))
    .limit(1)
    .get();

  const newOrder = lastRequest ? lastRequest.order + 1 : 1;

  await db.insert(requests).values({
    songId,
    order: newOrder,
  });

  // Emitir evento request:added para atualizar clientes em tempo real (se aplicável)
  try {
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
    console.warn("Falha ao emitir request:added (admin)", e);
  }

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function deleteRequest(id: number) {
  await verifyAuth();

  await db.delete(requests).where(eq(requests.id, id));

  // Emitir evento para atualizar clientes em tempo real
  try {
    const g = global as unknown as {
      io?: { emit: (event: string, payload?: unknown) => void };
    };
    if (typeof global !== "undefined" && g.io) {
      g.io.emit("request:removed", { requestId: id });
    }
  } catch (e) {
    console.warn("Falha ao emitir request:removed (admin)", e);
  }

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function reorderRequests(requestId: number, newOrder: number) {
  await verifyAuth();

  const request = await db
    .select()
    .from(requests)
    .where(eq(requests.id, requestId))
    .get();
  if (!request) throw new Error("Pedido não encontrado");

  const oldOrder = request.order;

  if (oldOrder === newOrder) return { success: true };

  // Ajustar outras ordens
  if (newOrder > oldOrder) {
    // Movendo para baixo
    await db
      .update(requests)
      .set({ order: oldOrder })
      .where(eq(requests.order, newOrder));
  } else {
    // Movendo para cima
    await db
      .update(requests)
      .set({ order: oldOrder })
      .where(eq(requests.order, newOrder));
  }

  // Atualizar a ordem do pedido
  await db
    .update(requests)
    .set({ order: newOrder })
    .where(eq(requests.id, requestId));

  // Notificar clientes que a lista de pedidos mudou (refetch no cliente)
  try {
    const g = global as unknown as {
      io?: { emit: (event: string, payload?: unknown) => void };
    };
    if (typeof global !== "undefined" && g.io) {
      g.io.emit("requests:updated");
    }
  } catch (e) {
    console.warn("Falha ao emitir requests:updated (admin)", e);
  }

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function getAllSongsForSelect() {
  await verifyAuth();

  return await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
    })
    .from(songs)
    .orderBy(asc(songs.title));
}
