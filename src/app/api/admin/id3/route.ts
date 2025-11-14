import { NextResponse } from "next/server";
import path from "node:path";
import NodeID3 from "node-id3";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const authResp = requireAdmin(request);
  if (authResp) return authResp;
  try {
    const { id, tags } = await request.json();
    if (!id || !tags) {
      return NextResponse.json(
        { error: "id and tags are required" },
        { status: 400 },
      );
    }

    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Determine actual filesystem path for song.path
    const publicRoot = path.join(process.cwd(), "public");
    const normalizedSongPath = song.path || "";
    let filePath: string;
    if (
      normalizedSongPath.startsWith("/music/") ||
      normalizedSongPath.startsWith("music/")
    ) {
      // project relative path under public
      filePath = path.join(publicRoot, normalizedSongPath.replace(/^\/?/, ""));
    } else if (path.isAbsolute(normalizedSongPath)) {
      // true filesystem absolute path
      filePath = normalizedSongPath;
    } else {
      // default: relative to public
      filePath = path.join(publicRoot, normalizedSongPath.replace(/^\/?/, ""));
    }

    // Validate file exists first
    try {
      await import("node:fs/promises").then((fs) => fs.access(filePath));
    } catch (_err) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 },
      );
    }

    // Update ID3 tags. Wrap in a promise to support async
    await new Promise<void>((resolve, reject) => {
      NodeID3.update(
        tags as NodeID3.Tags,
        filePath,
        (err: Error | null, _buffer: Buffer) => {
          if (err) return reject(err);
          resolve();
        },
      );
    });

    // Update DB title/artist if provided
    const updatePayload: Partial<{ title: string; artist: string }> = {};
    if (tags.title) updatePayload.title = tags.title;
    if (tags.artist) updatePayload.artist = tags.artist;

    if (Object.keys(updatePayload).length > 0) {
      await db.update(songs).set(updatePayload).where(eq(songs.id, id));
    }
    const [updated] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (global.io) global.io.emit("song:updated", updated);
    // Revalidate commonly affected pages so clients don't see stale caches
    try {
      await revalidatePath("/");
      await revalidatePath("/admin/musicas");
      await revalidatePath("/admin/estatisticas");
    } catch (err) {
      console.warn("Revalidate failed:", err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating id3 tags:", error);
    return NextResponse.json(
      { error: "Failed to update ID3 tags" },
      { status: 500 },
    );
  }
}
