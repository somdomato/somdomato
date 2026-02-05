import { db } from "@/db";
import { songs } from "@/db/schema";

export async function GET() {
  try {
    const all = await db
      .select({ id: songs.id, artist: songs.artist, cover: songs.cover })
      .from(songs);

    const map = new Map<
      string,
      { artist: string; cover: string | null; count: number }
    >();

    for (const s of all) {
      const name = s.artist;
      if (!map.has(name))
        map.set(name, { artist: name, cover: s.cover || null, count: 0 });
      const entry = map.get(name)!;
      entry.count += 1;
      if (!entry.cover && s.cover) entry.cover = s.cover;
    }

    const artists = Array.from(map.values()).sort((a, b) =>
      a.artist.localeCompare(b.artist),
    );

    return new Response(JSON.stringify({ artists }), { status: 200 });
  } catch (err) {
    console.error("/api/artists error:", err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
