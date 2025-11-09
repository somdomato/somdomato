import { db } from "@/db";
import { asc, eq, and, sql } from "drizzle-orm";
import fs from "node:fs/promises";
import { songs, history, requests } from "@/db/schema";
import { getCurrentTimeSlot } from "@/lib/time";
import { getBlockedSongIds } from "@/lib/protections";
import type { Song } from "@/types/song";

async function checkFileExists(filePath: string) {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const notificationParam = url.searchParams.get("notify");
    const includeNotification = notificationParam === "true";

    // Obter dados de músicas bloqueadas usando o helper
    const blockedData = await getBlockedSongIds();
    const blockedSongIds = blockedData.songIds;
    const blockedArtists = blockedData.artists;

    // Buscar músicas disponíveis no horário atual
    const currentTimeSlot = getCurrentTimeSlot();
    const availableSongs = await db
      .select()
      .from(songs)
      .where(
        and(
          sql`(${songs.timeSlots} & ${currentTimeSlot}) > 0`,
          blockedSongIds.length > 0
            ? sql`${songs.id} NOT IN (${blockedSongIds.join(",")})`
            : sql`1=1`,
        ),
      );

    // Filtrar músicas de artistas que tocaram recentemente
    const filteredSongs = availableSongs.filter(
      (song) => !blockedArtists.includes(song.artist),
    );

    if (filteredSongs.length === 0) {
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

    const [requestResult] = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        path: songs.path,
        cover: songs.cover,
        timeSlots: songs.timeSlots,
        createdAt: songs.createdAt,
        requestId: requests.id,
      })
      .from(requests)
      .orderBy(asc(requests.id))
      .limit(1)
      .innerJoin(songs, eq(songs.id, requests.songId));

    if (requestResult) {
      selectedSong = {
        id: requestResult.id,
        title: requestResult.title,
        artist: requestResult.artist,
        path: requestResult.path,
        cover: requestResult.cover,
        timeSlots: requestResult.timeSlots,
        createdAt: requestResult.createdAt,
      };
      await db.delete(requests).where(eq(requests.id, requestResult.requestId));
    }

    for (let attempt = 0; attempt < 100; attempt++) {
      const randomIndex = Math.floor(Math.random() * filteredSongs.length);
      selectedSong = filteredSongs[randomIndex];

      if (await checkFileExists(selectedSong.path)) {
        break;
      } else {
        await db.delete(songs).where(eq(songs.id, selectedSong.id));
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

    await db.insert(history).values({ songId: selectedSong.id });

    if (global.io) {
      global.io.emit("song:changed", selectedSong);
    }

    return Response.json({ ...selectedSong });
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
