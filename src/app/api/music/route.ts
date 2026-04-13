import { db } from "@/db";
import { asc, eq, and, sql, notInArray } from "drizzle-orm";
import fs from "node:fs/promises";
import { songs, requests, history } from "@/db/schema";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import { isLocalRequest } from "@/lib/localhost";
import {
  clearProspection,
  setLastServedId,
  setPendingSong,
  consumePendingSong,
  consumeProspectedSong,
} from "@/lib/prospection";
import {
  getSongCounter,
  incrementSongCounter,
  resetSongCounter,
  getJingleInterval,
  getRandomJingle,
} from "@/lib/jingles";
import type { Song } from "@/types";

async function checkFileExists(filePath: string) {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return Response.json({ error: "Acesso restrito" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const notificationParam = url.searchParams.get("notify");
    const includeNotification = notificationParam === "true";
    const genreParam = url.searchParams.get("genre") || "geral";
    const genre = genreParam as
      | "geral"
      | "gaucha"
      | "modao"
      | "arrocha"
      | "romantico"
      | "forro";

    // === JINGLE CHECK ===
    // If enough songs have played since the last jingle, serve a jingle instead
    const counter = getSongCounter(genre);
    const interval = await getJingleInterval();
    if (counter >= interval) {
      const jingle = await getRandomJingle();
      if (jingle) {
        resetSongCounter(genre);
        console.log(
          `[${genre}] Servindo vinheta: "${jingle.title}" (após ${counter} músicas)`,
        );
        return Response.json({
          id: jingle.id,
          title: jingle.title,
          artist: "Vinheta",
          path: jingle.path,
          cover: "/images/logotipo.svg",
          isJingle: true,
        });
      }
      // No active jingles available — proceed with normal song selection
    }

    // Obter dados de músicas bloqueadas usando o helper - FILTRADO POR GÊNERO
    const blockedData = await getBlockedSongIds(genre);
    const blockedSongIds = blockedData.songIds;
    const blockedArtists = blockedData.artists;

    // Buscar músicas disponíveis no horário atual e do gênero especificado
    const currentTimeSlot = getCurrentTimeSlot();

    // Para o Geral: buscar músicas do gênero "geral" OU músicas com allowedInGeneral=1
    // Para outros gêneros: buscar apenas do gênero específico
    let genreCondition: ReturnType<typeof sql>;
    if (genre === "geral") {
      genreCondition = sql`(${songs.genre} = 'geral' OR ${songs.allowedInGeneral} = 1)`;
    } else {
      genreCondition = sql`${songs.genre} = ${genre}`;
    }

    const availableSongs = await db
      .select()
      .from(songs)
      .where(
        and(
          sql`(${songs.timeSlots} & ${currentTimeSlot}) > 0`,
          genreCondition,
          blockedSongIds.length > 0
            ? notInArray(songs.id, blockedSongIds)
            : sql`1=1`,
        ),
      );

    // Filtrar músicas de artistas que tocaram recentemente
    const filteredSongs = availableSongs.filter(
      (song) => !blockedArtists.includes(song.artist),
    );

    // FALLBACK: Se não houver músicas do gênero específico, buscar do "geral"
    let finalFilteredSongs = filteredSongs;

    if (filteredSongs.length === 0 && genre !== "geral") {
      console.log(
        `[${genre}] Nenhuma música disponível, fazendo fallback para 'geral'`,
      );

      // Buscar proteções do geral
      const generalBlockedData = await getBlockedSongIds("geral");
      const generalBlockedSongIds = generalBlockedData.songIds;
      const generalBlockedArtists = generalBlockedData.artists;

      // Buscar músicas do geral
      const generalSongs = await db
        .select()
        .from(songs)
        .where(
          and(
            sql`(${songs.timeSlots} & ${currentTimeSlot}) > 0`,
            sql`(${songs.genre} = 'geral' OR ${songs.allowedInGeneral} = 1)`,
            generalBlockedSongIds.length > 0
              ? notInArray(songs.id, generalBlockedSongIds)
              : sql`1=1`,
          ),
        );

      finalFilteredSongs = generalSongs.filter(
        (song) => !generalBlockedArtists.includes(song.artist),
      );
    }

    if (finalFilteredSongs.length === 0) {
      const notification = includeNotification
        ? {
            type: "warning" as const,
            title: "Nenhuma música disponível",
            message:
              "Todas as músicas permitidas para este horário foram tocadas recentemente.",
          }
        : null;

      return Response.json({ music: null, notification });
    }

    let selectedSong: Song | null = null;

    // Apenas o gênero "geral" aceita pedidos
    let requestResult = null;
    if (genre === "geral") {
      const results = await db
        .select({
          id: songs.id,
          title: songs.title,
          artist: songs.artist,
          path: songs.path,
          cover: songs.cover,
          timeSlots: songs.timeSlots,
          createdAt: songs.createdAt,
          requestId: requests.id,
          genre: songs.genre,
          allowedInGeneral: songs.allowedInGeneral,
        })
        .from(requests)
        .orderBy(asc(requests.id))
        .where(eq(requests.songId, songs.id))
        .limit(1)
        .innerJoin(songs, eq(songs.id, requests.songId));

      requestResult = results[0] || null;
    }

    // Track se foi um pedido ou AutoDJ
    let wasFromRequest = false;

    if (requestResult) {
      wasFromRequest = true;
      selectedSong = {
        id: requestResult.id,
        title: requestResult.title,
        artist: requestResult.artist,
        path: requestResult.path,
        cover: requestResult.cover,
        timeSlots: requestResult.timeSlots,
        createdAt: requestResult.createdAt,
        genre: requestResult.genre,
        allowedInGeneral: requestResult.allowedInGeneral,
      } as Song & { genre: string; allowedInGeneral: number };

      // Remover o pedido da fila (sem emitir evento — a UI atualiza via song:changed no on_track)
      await db.delete(requests).where(eq(requests.id, requestResult.requestId));

      // Verificar se o arquivo do pedido existe. Se não, pular para seleção aleatória.
      const requestFileExists = await checkFileExists(requestResult.path);
      if (!requestFileExists) {
        console.warn(
          `[music] Arquivo do pedido não encontrado: ${requestResult.path} (songId=${requestResult.id})`,
        );
        selectedSong = null;
        wasFromRequest = false;
      }
    }

    // Se não temos uma música selecionada por pedido (ou o arquivo do pedido faltou),
    // tentar usar a música prospectada (mesma que a UI mostrou), senão aleatória
    if (!selectedSong) {
      // 1. Tentar a música prospectada (garante consistência com bloco "Próximas")
      const prospected = consumeProspectedSong(genre);
      if (prospected) {
        const match = finalFilteredSongs.find((s) => s.id === prospected.id);
        if (match && (await checkFileExists(match.path))) {
          selectedSong = match;
        }
      }

      // 2. Fallback: selecionar aleatoriamente
      if (!selectedSong) {
        const candidates = [...finalFilteredSongs];

        for (
          let attempt = 0;
          attempt < Math.min(candidates.length, 100);
          attempt++
        ) {
          const randomIndex = Math.floor(Math.random() * candidates.length);
          const candidate = candidates[randomIndex];

          if (await checkFileExists(candidate.path)) {
            selectedSong = candidate;
            break;
          } else {
            console.warn(
              `[music] Arquivo não encontrado: ${candidate.path} (songId=${candidate.id})`,
            );
            candidates.splice(randomIndex, 1);
            if (candidates.length === 0) break;
          }
        }
      }
    }

    if (!selectedSong) {
      return Response.json({
        music: null,
        notification: {
          type: "error" as const,
          title: "Nenhuma música encontrada",
          message: "Não foi possível encontrar um arquivo de música existente.",
        },
      });
    }

    // Resolução de capa (melhor esforço, sem Deezer para não atrasar resposta)
    // A resolução completa (com Deezer) roda async em /api/music/started
    try {
      const { validateCoverForDb, extractAndSaveCover, checkExistingCover } =
        await import("@/lib/cover");

      const validCover = await validateCoverForDb(selectedSong.cover);
      if (!validCover) {
        // Capa ausente ou inválida — tentar disco + ID3 (rápido)
        let resolved: string | null = null;
        try {
          resolved = await extractAndSaveCover(
            selectedSong.path,
            selectedSong.artist,
          );
        } catch {
          // ignora
        }
        if (!resolved) {
          resolved = await checkExistingCover(selectedSong.artist).catch(
            () => null,
          );
        }
        const verified = await validateCoverForDb(resolved);
        if (verified) {
          await db
            .update(songs)
            .set({ cover: verified })
            .where(eq(songs.id, selectedSong.id));
          selectedSong.cover = verified;
        } else {
          selectedSong.cover = null;
        }
      }
    } catch (err) {
      console.error("Erro ao processar capa da música:", err);
    }

    // Garantir um valor seguro para envio ao frontend (fallback se não tivermos capa)
    const safeCover = selectedSong.cover || "/images/logotipo.svg";

    // Flush: se havia um pending anterior que nunca recebeu on_track, inserir histórico
    const stale = consumePendingSong(genre);
    if (stale) {
      try {
        await db.insert(history).values({
          songId: stale.songId,
          genre: stale.genre,
          wasRequested: stale.wasRequested ? 1 : 0,
        });
        if (global.io) {
          global.io.emit("song:changed", {
            id: stale.songId,
            title: stale.title,
            artist: stale.artist,
            cover: stale.cover || "/images/logotipo.svg",
            playedAt: stale.selectedAt,
            playedOnMountpoint: stale.genre,
            wasRequested: stale.wasRequested,
          });
        }
      } catch (err) {
        console.error("[music] Erro ao inserir histórico pendente:", err);
      }
    }

    // Registrar como pendente — histórico e eventos serão emitidos por /api/music/started
    setPendingSong(genre, {
      songId: selectedSong.id,
      title: selectedSong.title,
      artist: selectedSong.artist,
      cover: safeCover,
      genre,
      wasRequested: wasFromRequest,
      selectedAt: Date.now(),
    });

    // Atualizar prospecção: limpar cache e registrar último servido
    clearProspection(genre);
    setLastServedId(genre, selectedSong.id);

    // Incrementar contador de músicas para vinhetas
    incrementSongCounter(genre);

    return Response.json({ ...selectedSong, wasRequested: wasFromRequest });
  } catch (error) {
    console.error("Error getting music:", error);

    const url = new URL(request.url);
    const notificationParam = url.searchParams.get("notify");
    const includeNotification = notificationParam === "true";

    const notification = includeNotification
      ? {
          type: "error" as const,
          title: "Erro interno",
          message: "Falha ao buscar música disponível",
        }
      : null;

    return Response.json(
      { error: "Falha ao buscar música", notification },
      { status: 500 },
    );
  }
}
