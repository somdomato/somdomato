import { db } from "@/db";
import { asc, eq, and, sql, notInArray } from "drizzle-orm";
import fs from "node:fs/promises";
import { songs, history, requests } from "@/db/schema";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import { isLocalRequest } from "@/lib/localhost";
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

      // Remover o pedido da fila e emitir evento de remoção
      await db.delete(requests).where(eq(requests.id, requestResult.requestId));
      if (global.io) global.io.emit("request:removed", requestResult);

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
    // buscar por uma música aleatória válida
    if (!selectedSong) {
      // Filtrar músicas com arquivos inexistentes sem deletar do banco
      const candidates = [...finalFilteredSongs];
      selectedSong = null;

      for (let attempt = 0; attempt < Math.min(candidates.length, 100); attempt++) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const candidate = candidates[randomIndex];

        if (await checkFileExists(candidate.path)) {
          selectedSong = candidate;
          break;
        } else {
          console.warn(
            `[music] Arquivo não encontrado: ${candidate.path} (songId=${candidate.id})`,
          );
          // Remover da lista de candidatos para não selecionar de novo
          candidates.splice(randomIndex, 1);
          if (candidates.length === 0) break;
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

    // Garantir que haja um caminho de capa no banco antes de emitir (melhor esforço)
    try {
      const { extractAndSaveCover, checkExistingCover, verifyCoverOnDisk } =
        await import("@/lib/cover");

      let coverPath: string | null = selectedSong.cover ?? null;

      // Se já houver cover salvo, verificar se o arquivo físico existe. Se não existir, forçar nova busca.
      if (coverPath) {
        coverPath = await verifyCoverOnDisk(coverPath);
      }

      // Tentar extrair capa embutida no MP3
      if (!coverPath) {
        try {
          const extracted = await extractAndSaveCover(
            selectedSong.path,
            selectedSong.artist,
          );
          if (extracted) coverPath = extracted;
        } catch (err) {
          console.error("Erro ao extrair capa:", err);
        }
      }

      // Se não extraímos, procurar por capa existente no disco para este artista
      if (!coverPath) {
        try {
          const found = await checkExistingCover(selectedSong.artist);
          if (found) coverPath = found;
        } catch (err) {
          console.error("Erro ao procurar capa por artista:", err);
        }
      }

      // Atualizar DB se encontramos um caminho válido e verificado no disco
      if (coverPath && coverPath !== selectedSong.cover) {
        const verified = await verifyCoverOnDisk(coverPath);
        if (verified) {
          await db
            .update(songs)
            .set({ cover: verified })
            .where(eq(songs.id, selectedSong.id));
          selectedSong.cover = verified;
        } else {
          selectedSong.cover = null;
        }
      } else if (!coverPath && selectedSong.cover) {
        // A capa referenciada no DB não existe mais. **Não** gravar `null` no banco (isso
        // causa quebras de imagem). Em vez disso, registrar um aviso e usar o fallback
        // ao enviar ao frontend. Se quiser, podemos atualizar para o valor padrão explicitamente.
        try {
          console.warn(
            `Capa referenciada para a música ${selectedSong.id} não existe: ${selectedSong.cover}`,
          );
        } catch (e) {
          console.error("Erro ao tratar capa ausente:", e);
        }
        // Não atualizar o banco para null; o fallback será aplicado abaixo ao enviar ao frontend
        selectedSong.cover = null;
      }
    } catch (err) {
      console.error("Erro ao processar capa da música:", err);
    }

    // Garantir um valor seguro para envio ao frontend (fallback se não tivermos capa)
    const safeCover = selectedSong.cover || "/images/logotipo.svg";
    selectedSong.cover = safeCover;

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
