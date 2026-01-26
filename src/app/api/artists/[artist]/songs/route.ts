import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, context: { params: { artist: string } | Promise<{ artist: string }> }) {
  try {
    const p = await (context.params as Promise<{ artist: string }> | { artist: string });
    const artistParam = decodeURIComponent(p.artist);

    const rows = await db.select({ id: songs.id, title: songs.title, artist: songs.artist, cover: songs.cover, path: songs.path, createdAt: songs.createdAt }).from(songs).where(eq(songs.artist, artistParam));

    return new Response(JSON.stringify({ songs: rows }), { status: 200 });
  } catch (err) {
    console.error(`/api/artists/[artist]/songs error:`, err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
