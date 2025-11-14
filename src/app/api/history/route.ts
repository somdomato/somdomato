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

    return NextResponse.json({ history: allHistory }, { status: 200 });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}
