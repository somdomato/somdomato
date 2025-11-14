import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, songs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
      .where(and(eq(likes.songId, songIdNum), eq(likes.userIp, userIp)))
      .limit(1);
    if (existingLike) {
      return NextResponse.json({ error: "Already liked" }, { status: 409 });
    }

    const [inserted] = await db
      .insert(likes)
      .values({ songId, userIp })
      .returning();

    // Emit singular event name to match other socket events convention (e.g. "request:added").
    // Keep plural event for backward compatibility if some clients still listen for it.
    if (global.io) {
      global.io.emit("like:added", { songId, likeId: inserted.id });
      global.io.emit("likes:added", { songId, likeId: inserted.id });
    } else {
      console.warn(
        "No socket.io server available: cannot emit like events in production",
      );
    }
    try {
      revalidatePath("/");
      revalidatePath("/top10");
    } catch (err) {
      console.warn("Revalidate failed:", err);
    }

    await db
      .update(songs)
      .set({ likes: sql`${songs.likes} + 1` })
      .where(eq(songs.id, songIdNum));

    return NextResponse.json({ success: true, like: inserted });
  } catch (error) {
    console.error("Error creating like:", error);
    return NextResponse.json({ error: "Failed to add like" }, { status: 500 });
  }
}
