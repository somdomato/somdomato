import { db } from "@/db";
import { sql } from "drizzle-orm";
import { history, songs, likes } from "@/db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const by = url.searchParams.get("by") || "plays";
  try {
    // Count occurrences in history grouped by songId, order desc and limit 10
    if (by === "likes") {
      const result = await db
        .select({ songId: likes.songId, likeCount: sql`COUNT(*)` })
        .from(likes)
        .groupBy(likes.songId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(10);

      const songIds = result.map((r) => r.songId);
      if (songIds.length === 0) {
        return Response.json({ top: [] });
      }

      const songsResult = await db
        .select()
        .from(songs)
        .where(sql`${songs.id} IN (${songIds.join(",")})`);

      // Sort result to match likes order
      const songsMap = new Map(songsResult.map((s) => [s.id, s]));
      const ordered = songIds.map((id) => songsMap.get(id)).filter(Boolean);
      return Response.json({ top: ordered });
    }

    // default: by plays
    const result = await db
      .select({
        songId: history.songId,
        playCount: sql`COUNT(*)`,
      })
      .from(history)
      .groupBy(history.songId)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    const songIds = result.map((r) => r.songId);
    if (songIds.length === 0) {
      return Response.json({ top: [] });
    }

    const songsResult = await db
      .select()
      .from(songs)
      .where(sql`${songs.id} IN (${songIds.join(",")})`);

    // Sort result to match history order (descending by play count)
    const songsMap = new Map(songsResult.map((s) => [s.id, s]));
    const ordered = songIds.map((id) => songsMap.get(id)).filter(Boolean);

    return Response.json({ top: ordered });
  } catch (error) {
    console.error("Error getting top 10:", error);
    return Response.json({ top: [] }, { status: 500 });
  }
}
