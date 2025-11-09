import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ song: string }> },
) {
  const { song } = await params;
  if (!song) return Response.json({ message: "No song parameter provided" });

  const result = await db
    .select()
    .from(songs)
    .where(
      or(
        eq(sql`LOWER(${sql`title`})`, song.toLowerCase()),
        eq(sql`LOWER(${sql`artist`})`, song.toLowerCase()),
      ),
    )
    .orderBy(songs.id);

  return Response.json({ songs: result });
}
