import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  context: { params: { artist: string } | Promise<{ artist: string }> },
) {
  try {
    const p = await (context.params as
      | Promise<{ artist: string }>
      | { artist: string });
    const artistParam = decodeURIComponent(p.artist);
    // Map special token to empty artist value
    const searchArtist = artistParam === "__EMPTY_ARTIST__" ? "" : artistParam;

    // Try exact match first
    let rows = await db
      .select()
      .from(songs)
      .where(eq(songs.artist, searchArtist));

    // Fallback: if nothing matched, attempt a normalized comparison (trim/lower/remove diacritics)
    if (!rows || rows.length === 0) {
      try {
        const { normalizeString } = await import("@/db/utils");
        const all = await db
          .select()
          .from(songs);
        const normalizedParam = normalizeString(searchArtist);
        rows = all.filter((r) => normalizeString(r.artist) === normalizedParam);
      } catch (e) {
        // If normalization fails for any reason, keep rows as-is (empty)
        console.warn("artist normalization fallback failed:", e);
      }
    }

    return new Response(JSON.stringify({ songs: rows }), { status: 200 });
  } catch (err) {
    console.error(`/api/artists/[artist]/songs error:`, err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
}
