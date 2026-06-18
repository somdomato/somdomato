import { db } from "@/db";
import { eq } from "drizzle-orm";
import { songs, requests } from "@/db/schema";
import { checkFileExists } from "@/lib/file";
import { isLocalRequest } from "@/lib/localhost";
import { DEFAULT_COVER } from "@/lib/cover-constants";
import {
  ensureQueue,
  popNext,
  removeMissingSong,
  flushStalePending,
} from "@/lib/queue";
import {
  getSongCounter,
  incrementSongCounter,
  resetSongCounter,
  getJingleInterval,
  getRandomJingle,
} from "@/lib/jingles";
import type { Song } from "@/types";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return Response.json({ error: "Acesso restrito" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const genreParam = url.searchParams.get("genre") || "geral";
    const genre = genreParam as
      | "geral"
      | "gaucha"
      | "modao"
      | "arrocha"
      | "romantico";

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
          cover: DEFAULT_COVER,
          isJingle: true,
        });
      }
      // No active jingles available — proceed with normal song selection
    }

    // === SELEÇÃO VIA FILA (AutoDJ + Pedidos) ===
    await ensureQueue(genre);

    let selectedSong:
      | (Song & { genre: string; allowedInGeneral: number })
      | null = null;
    let wasFromRequest = false;
    let selectedQueueEntryId: number | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const entry = await popNext(genre);
      if (!entry) break;

      if (entry.source === "request" && entry.requestId !== undefined) {
        // Remover o pedido da fila do banco (sem emitir evento — a UI
        // atualiza via song:changed no on_track)
        await db.delete(requests).where(eq(requests.id, entry.requestId));
      }

      const fileExists = await checkFileExists(entry.path);
      if (!fileExists) {
        console.warn(
          `[music] Arquivo não encontrado: ${entry.path} (songId=${entry.id}) — removendo do banco`,
        );
        await removeMissingSong(entry);
        await ensureQueue(genre);
        continue;
      }

      selectedSong = {
        id: entry.id,
        title: entry.title,
        artist: entry.artist,
        path: entry.path,
        cover: entry.cover,
        timeSlots: null,
        createdAt: null,
        genre: entry.genre,
        allowedInGeneral: entry.allowedInGeneral,
      };
      wasFromRequest = entry.source === "request";
      selectedQueueEntryId = entry.queueEntryId;
      break;
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
          selectedSong.cover = DEFAULT_COVER;
        }
      }
    } catch (err) {
      console.error("Erro ao processar capa da música:", err);
    }

    // Flush: se havia um pending anterior (de uma chamada passada) que nunca
    // recebeu on_track, marca-o como "skipped" (nunca virou "current") em
    // vez de deixá-lo travado em "pending" para sempre.
    const stale = selectedQueueEntryId
      ? await flushStalePending(genre, selectedQueueEntryId)
      : null;
    if (stale && global.io) {
      global.io.emit("song:changed", {
        id: stale.songId,
        title: stale.title,
        artist: stale.artist,
        cover: stale.cover || DEFAULT_COVER,
        playedAt: stale.selectedAt,
        playedOnMountpoint: stale.genre,
        wasRequested: stale.wasRequested,
      });
    }

    // A linha já está marcada como "pending" no banco (ver popNext) —
    // /api/music/started promove para "current" e emite song:changed.

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
