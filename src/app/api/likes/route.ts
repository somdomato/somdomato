import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes } from "@/db/schema";
// No SQL helper required here.

export async function POST(request: Request) {
  try {
    const { songId } = await request.json();
    if (!songId)
      return NextResponse.json(
        { error: "songId is required" },
        { status: 400 },
      );

    const userIp =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const songIdNum = Number(songId);

    // Prevent duplicate likes from the same IP for the same song
    const [existingLike] = await db
      .select()
      .from(likes)
      .where(likes.songId.eq(songIdNum))
      .where(likes.userIp.eq(userIp))
      .limit(1);
    if (existingLike) {
      return NextResponse.json({ error: "Already liked" }, { status: 409 });
    }

    const [inserted] = await db
      .insert(likes)
      .values({ songId, userIp })
      .returning();

    if (global.io)
      global.io.emit("likes:added", { songId, likeId: inserted.id });

    return NextResponse.json({ success: true, like: inserted });
  } catch (error) {
    console.error("Error creating like:", error);
    return NextResponse.json({ error: "Failed to add like" }, { status: 500 });
  }
}
