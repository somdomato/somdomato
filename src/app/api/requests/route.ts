import { db } from "@/db";
import { requests, songs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const upcoming = await db
      .select({ reqId: requests.id, id: songs.id, title: songs.title, artist: songs.artist, cover: songs.cover, requestedAt: requests.createdAt })
      .from(requests)
      .innerJoin(songs, eq(requests.songId, songs.id))
      .orderBy(asc(requests.order), asc(requests.createdAt))
      .limit(10);

    return new Response(JSON.stringify({ upcoming }), { status: 200 });
  } catch (err) {
    console.error("/api/requests error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
