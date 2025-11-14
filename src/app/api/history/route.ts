import { NextResponse } from "next/server";
import { db } from "@/db";
import { history, songs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const allHistory = await db
      .select()
      .from(history)
      .innerJoin(songs, eq(songs.id, history.songId))
      .orderBy(history.id)
      .limit(20);

    // Drizzle returns rows with keys matching table names (history, songs). The
    // frontend `History` component expects `history` + `song` (singular). Map
    // the results to the expected shape for consistency with other endpoints
    // and the `HistoryWithSongs` type.
    const normalized = allHistory.map((row) => ({
      history: row.history,
      song: row.songs,
    }));

    return NextResponse.json({ history: normalized }, { status: 200 });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}
