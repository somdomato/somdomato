"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { songs, requests, history, likes } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import NodeID3 from "node-id3";
import { normalizeString } from "@/db/utils";
import { ADMIN_ROLES, type Permission, type Role } from "@/lib/permissions";
import { logAction } from "@/lib/logging";
import { syncRequestsInQueue } from "@/lib/queue";

// Tipos
export type RotationType =
  | "inativo"
  | "ultraleve"
  | "leve"
  | "normal"
  | "pesado"
  | "ultrapesada";
export type Genre = "geral" | "gaucha" | "modao" | "arrocha" | "romantico";

// Verificação de autenticação via cookie com suporte a permissões
export async function verifyAuth(requiredPermission?: Permission) {
  const { cookies } = await import("next/headers");
  const { getUserFromSession } = await import("@/lib/session");
  const cookieStore = await cookies();
  const session = getUserFromSession(cookieStore);

  if (!session || !ADMIN_ROLES.includes(session.role as Role)) {
    throw new Error("Não autorizado");
  }

  if (session.role === "super_admin") return session;

  if (requiredPermission) {
    const { rolePermissions } = await import("@/db/schema");
    const { and, eq: eqOp } = await import("drizzle-orm");
    const perm = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eqOp(rolePermissions.role, session.role),
          eqOp(rolePermissions.permission, requiredPermission),
        ),
      )
      .limit(1)
      .get();

    if (!perm) throw new Error("Permissão insuficiente");
  }

  return session;
}

/** Check if current user has a specific permission (returns boolean, does not throw) */
async function checkPermission(
  session: { id: string; role: string },
  permission: Permission,
): Promise<boolean> {
  if (session.role === "super_admin") return true;
  const { rolePermissions } = await import("@/db/schema");
  const { and, eq: eqOp } = await import("drizzle-orm");
  const perm = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eqOp(rolePermissions.role, session.role),
        eqOp(rolePermissions.permission, permission),
      ),
    )
    .limit(1)
    .get();
  return !!perm;
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
    const rows = await db.select().from(songs).orderBy(asc(songs.artist));

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
    .orderBy(asc(songs.artist));

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
  const session = await verifyAuth();

  // Check granular permissions
  const isChangingFile = !!data.filename;
  const isChangingTags =
    !!data.title ||
    !!data.artist ||
    !!data.album ||
    !!data.rotation ||
    data.timeSlots !== undefined ||
    !!data.genre ||
    data.allowedInGeneral !== undefined ||
    !!data.coverFile ||
    !!data.resetCover;

  if (isChangingFile) {
    const canEditFile = await checkPermission(session, "songs:edit_file");
    if (!canEditFile) throw new Error("Sem permissão para editar arquivo");
  }
  if (isChangingTags) {
    const canEditTags = await checkPermission(session, "songs:edit_tags");
    if (!canEditTags) throw new Error("Sem permissão para editar tags");
  }

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
      // Verificar se o arquivo existe antes de renomear
      try {
        await fs.access(oldPath);
      } catch {
        throw new Error(`Arquivo original não encontrado no disco: ${oldPath}`);
      }

      // Tentar rename com retry (arquivo pode ser deletado entre check e rename por outro processo)
      let success = false;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await fs.rename(oldPath, newPath);
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // Se foi ENOENT (arquivo não encontrado), arquivo foi deletado - não faz retry
          if (
            lastError.message.includes("ENOENT") ||
            lastError.message.includes("no such file")
          ) {
            throw new Error(
              `Arquivo foi deletado antes de renomear: ${oldPath}`,
            );
          }
          // Se for erro de permissão, também não faz retry
          if (
            lastError.message.includes("EACCES") ||
            lastError.message.includes("Permission denied")
          ) {
            throw lastError;
          }
          // Para outros erros (EBUSY, etc), tenta novamente após 100ms
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      if (!success) {
        throw lastError || new Error("Falha ao renomear arquivo");
      }

      currentPath = newPath;
      data.filename = newPath; // Atualizar caminho no banco
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "desconhecido";
      console.error("Erro ao renomear arquivo:", {
        oldPath: song.path,
        newPath,
        error: errorMsg,
      });
      throw new Error(`Erro ao renomear arquivo: ${errorMsg}`);
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

      // Remover imagem embutida no ID3 preservando as demais tags
      // Ler tags atuais, remover tudo, e reescrever sem a imagem
      const existingTags = NodeID3.read(currentPath);
      if (existingTags?.image) {
        NodeID3.removeTags(currentPath);
        // Reescrever todas as tags exceto a imagem
        const { image: _removed, ...tagsWithoutImage } = existingTags;
        NodeID3.update(tagsWithoutImage, currentPath);
      }

      // Remover o arquivo de capa do disco para permitir re-fetch limpo
      const { deleteArtistCover } = await import("@/lib/cover");
      const artistName = (data.artist as string) ?? song.artist;
      await deleteArtistCover(artistName);
      // Se o artista mudou, remover a capa antiga também
      if (data.artist && data.artist !== song.artist) {
        await deleteArtistCover(song.artist);
      }
    } else if (data.coverFile || data.artist) {
      // Só processar capa se houve upload de nova capa ou mudança de artista
      const {
        resolveSongCover,
        validateCoverForDb,
        coverPublicPath,
        checkExistingCover,
      } = await import("@/lib/cover");

      const artistName = (data.artist as string) ?? song.artist;

      // Se o artista mudou, migrar/copiar o arquivo de capa para o novo slug
      let coverHandled = false;
      if (data.artist && data.artist !== song.artist) {
        const { existsSync } = await import("node:fs");
        const { copyFile } = await import("node:fs/promises");
        const oldCoverPath = coverPublicPath(song.artist);
        const newCoverPath = coverPublicPath(data.artist);
        if (existsSync(oldCoverPath) && !existsSync(newCoverPath)) {
          try {
            // Verificar se outras músicas ainda usam o artista antigo
            const othersWithOldArtist = await db
              .select({ id: songs.id })
              .from(songs)
              .where(eq(songs.artist, song.artist))
              .limit(2);
            const othersExist = othersWithOldArtist.some((s) => s.id !== id);
            if (othersExist) {
              await copyFile(oldCoverPath, newCoverPath);
            } else {
              const { rename } = await import("node:fs/promises");
              await rename(oldCoverPath, newCoverPath);
            }
          } catch (e) {
            console.warn("[cover] Erro ao migrar capa para novo artista:", e);
          }
        }
        // Atualizar cover para o novo slug se a capa existe
        const newCoverUrl = await checkExistingCover(data.artist);
        if (newCoverUrl) {
          const verified = await validateCoverForDb(newCoverUrl);
          if (verified) {
            await db
              .update(songs)
              .set({ cover: verified })
              .where(eq(songs.id, id));
            coverHandled = true;
          }
        }
      }

      // Resolução completa se necessário (nova capa ou migração falhou)
      if (!coverHandled) {
        const resolved = await resolveSongCover({
          mp3Path: currentPath,
          artist: artistName,
          title: (data.title as string) ?? song.title,
        });
        const verified = await validateCoverForDb(resolved);
        if (verified) {
          await db
            .update(songs)
            .set({ cover: verified })
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

  await logAction({
    action: "song:updated",
    targetType: "song",
    targetId: id,
    details: {
      title: updated?.title,
      artist: updated?.artist,
      genre: data.genre,
      rotation: data.rotation,
    },
  });

  return { success: true, song: updated };
}

export async function deleteSong(id: number) {
  await verifyAuth("songs:delete");

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

  await syncRequestsInQueue("geral");

  // Deletar do banco
  await db.delete(songs).where(eq(songs.id, id));

  // Se não há mais músicas deste artista, remover a capa para poupar espaço
  const remaining = await db
    .select()
    .from(songs)
    .where(eq(songs.artist, song.artist))
    .limit(1)
    .get();

  if (!remaining) {
    try {
      const { deleteArtistCover } = await import("@/lib/cover");
      await deleteArtistCover(song.artist);
    } catch (error) {
      console.error("Erro ao remover capa órfã:", error);
    }
  }

  await logAction({
    action: "song:deleted",
    targetType: "song",
    targetId: id,
    details: { title: song.title, artist: song.artist },
  });

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Tenta recuperar a capa de uma música (disco → ID3 → Deezer). Se nada for
 * encontrado, usa a capa padrão. Usado pelo botão "Recuperar capa" no admin.
 */
export async function recoverSongCover(id: number) {
  await verifyAuth("songs:edit_tags");

  const song = await db.select().from(songs).where(eq(songs.id, id)).get();
  if (!song) throw new Error("Música não encontrada");

  const { resolveSongCover, validateCoverForDb } = await import("@/lib/cover");

  const resolved = await resolveSongCover({
    mp3Path: song.path,
    artist: song.artist,
    title: song.title,
  });
  const verified = await validateCoverForDb(resolved);
  const cover = verified ?? "/images/logotipo.svg";

  await db.update(songs).set({ cover }).where(eq(songs.id, id));

  if (global.io) {
    global.io.emit("song:cover", { songId: id, cover });
  }

  revalidatePath("/admin");
  return { cover, recovered: !!verified };
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

  await syncRequestsInQueue("geral");

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

  // Buscar info da música para log
  const songInfo = await db
    .select({ title: songs.title, artist: songs.artist })
    .from(songs)
    .where(eq(songs.id, songId))
    .get();
  await logAction({
    action: "request:added",
    details: {
      title: songInfo?.title,
      artist: songInfo?.artist,
      source: "admin",
    },
    targetType: "request",
    targetId: songId,
  });

  revalidatePath("/admin/requests");
  return { success: true };
}

export async function deleteRequest(id: number) {
  await verifyAuth();

  await db.delete(requests).where(eq(requests.id, id));

  await syncRequestsInQueue("geral");

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

  await logAction({
    action: "request:removed",
    details: { source: "admin" },
    targetType: "request",
    targetId: id,
  });

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

  await syncRequestsInQueue("geral");

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

  await logAction({
    action: "request:reordered",
    details: { newOrder },
    targetType: "request",
    targetId: requestId,
  });

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

export interface DuplicateGroup {
  key: string;
  songs: {
    id: number;
    title: string;
    artist: string;
    path: string;
    cover: string | null;
    requests: number | null;
    rotation: string | null;
    genre: string | null;
    recommended: boolean;
  }[];
}

export async function getDuplicateSongs(): Promise<DuplicateGroup[]> {
  await verifyAuth();

  const all = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      path: songs.path,
      cover: songs.cover,
      requests: songs.requests,
      rotation: songs.rotation,
      genre: songs.genre,
    })
    .from(songs)
    .orderBy(asc(songs.title));

  // Agrupar por chave normalizada: artista|título
  const groups = new Map<string, typeof all>();
  for (const song of all) {
    const key = `${normalizeString(song.artist)}|${normalizeString(song.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(song);
  }

  const duplicates: DuplicateGroup[] = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    // Recomendar: maior requests; empate → menor id
    const recommended = group.reduce((best, s) => {
      const bReq = best.requests ?? 0;
      const sReq = s.requests ?? 0;
      if (sReq > bReq) return s;
      if (sReq === bReq && s.id < best.id) return s;
      return best;
    });

    duplicates.push({
      key,
      songs: group.map((s) => ({ ...s, recommended: s.id === recommended.id })),
    });
  }

  // Ordenar por número de duplicatas (maior grupo primeiro)
  duplicates.sort((a, b) => b.songs.length - a.songs.length);

  return duplicates;
}
