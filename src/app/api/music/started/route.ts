import { db } from "@/db";
import { eq } from "drizzle-orm";
import { songs, history } from "@/db/schema";

/**
 * Called by Liquidsoap's on_track callback when a song actually starts playing.
 * Inserts into history and emits the song:changed socket event.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const songId = Number(url.searchParams.get("songId"));
    const genre = url.searchParams.get("genre") || "geral";
    const wasRequested = url.searchParams.get("wasRequested") === "1";

    if (!songId || Number.isNaN(songId)) {
      return Response.json(
        { error: "Missing or invalid songId" },
        { status: 400 },
      );
    }

    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) {
      return Response.json({ error: "Song not found" }, { status: 404 });
    }

    await db.insert(history).values({
      songId: song.id,
      genre,
      wasRequested: wasRequested ? 1 : 0,
    });

    const safeCover = song.cover || "/images/logotipo.svg";

    if (global.io) {
      global.io.emit("song:changed", {
        id: song.id,
        title: song.title,
        artist: song.artist,
        cover: safeCover,
        genre: song.genre,
        allowedInGeneral: song.allowedInGeneral,
        playedAt: Date.now(),
        playedOnMountpoint: genre,
        wasRequested,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error in /api/music/started:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
