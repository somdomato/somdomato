import { db } from "@/db";
import { eq } from "drizzle-orm";
import { songs } from "@/db/schema";
import { isLocalRequest } from "@/lib/localhost";
import { setCurrent } from "@/lib/queue";

const DEFAULT_COVER = "/images/logotipo.svg";

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
 * Emite `song:cover` via socket para que os clientes atualizem sem reload.
 */
async function triggerCoverResolution(
  songId: number,
  mp3Path: string,
  artist: string,
  title: string,
): Promise<void> {
  const { resolveSongCover, verifyCoverOnDisk } = await import("@/lib/cover");

  const coverUrl = await resolveSongCover({ mp3Path, artist, title });
  // Verificar se o arquivo realmente existe no disco antes de salvar
  const verified = coverUrl ? await verifyCoverOnDisk(coverUrl) : null;
  const cover = verified ?? DEFAULT_COVER;

  // Verificar novamente antes de salvar: outra instância pode ter resolvido
  const [current] = await db
    .select({ cover: songs.cover })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (current?.cover && current.cover !== DEFAULT_COVER) return;

  await db.update(songs).set({ cover }).where(eq(songs.id, songId));

  // Notificar clientes sobre a nova capa via socket
  if (global.io && verified) {
    global.io.emit("song:cover", { songId, cover });
  }
}
