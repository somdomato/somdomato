import { isLocalRequest } from "@/lib/localhost";
import { setCurrent } from "@/lib/queue";
import { DEFAULT_COVER } from "@/lib/cover-constants";
import { resolveAndPersistCover } from "@/lib/cover";

/**
 * Called by Liquidsoap's on_track callback when a song actually starts playing.
 * This is the moment we insert history and emit song:changed, so the UI only
 * updates when the listener actually hears the new song.
 */
export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return Response.json({ error: "Acesso restrito" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const songId = Number(url.searchParams.get("songId"));
    const genre = url.searchParams.get("genre") || "geral";
    const wasRequestedParam = url.searchParams.get("wasRequested") === "1";

    if (!songId || Number.isNaN(songId)) {
      return Response.json(
        { error: "Missing or invalid songId" },
        { status: 400 },
      );
    }

    // Promove a linha "pending" correspondente para "current" no banco —
    // este é o momento real de reprodução. Rebaixa a "current" anterior
    // (se houver) para "played" na mesma transação.
    const confirmed = await setCurrent({
      genre,
      songId,
      wasRequestedFallback: wasRequestedParam,
    });

    if (!confirmed) {
      return Response.json({ error: "Song not found" }, { status: 404 });
    }

    const safeCover = confirmed.cover || DEFAULT_COVER;

    // Emitir song:changed — UI atualiza "Últimas", "Próximas" e Player
    if (global.io) {
      global.io.emit("song:changed", {
        id: confirmed.songId,
        title: confirmed.title,
        artist: confirmed.artist,
        cover: safeCover,
        genre: confirmed.genre,
        allowedInGeneral: confirmed.allowedInGeneral,
        playedAt: Date.now(),
        playedOnMountpoint: genre,
        wasRequested: confirmed.wasRequested,
      });
    }

    // Disparar resolução de capa de forma assíncrona (fire-and-forget).
    // Só executa quando a capa é o padrão — protege capas definidas pelo admin.
    if (!confirmed.cover || confirmed.cover === DEFAULT_COVER) {
      triggerCoverResolution(
        confirmed.songId,
        confirmed.path,
        confirmed.artist,
        confirmed.title,
      ).catch((e) => console.error("[cover] Erro na resolução assíncrona:", e));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error in /api/music/started:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Resolve a capa da música de forma assíncrona e atualiza o banco.
 * `resolveAndPersistCover` já é idempotente em relação a corridas (não
 * sobrescreve uma capa já definida por outra chamada) e emite `song:cover`
 * via socket para que os clientes atualizem sem reload.
 */
async function triggerCoverResolution(
  songId: number,
  mp3Path: string,
  artist: string,
  title: string,
): Promise<void> {
  await resolveAndPersistCover({ songId, mp3Path, artist, title });
}
