import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const authResp = requireAdmin(request);
  if (authResp) return authResp;
  try {
    const { id, newFileName } = await request.json();
    if (!id || !newFileName) {
      return NextResponse.json(
        { error: "id and newFileName are required" },
        { status: 400 },
      );
    }

    // sanitize newFileName: remove any path separators
    const safeName = path.basename(newFileName);
    // ensure extension
    const ext = path.extname(safeName) || ".mp3";
    const finalName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;

    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const publicRoot = path.join(process.cwd(), "public");
    const normalizedSongPath = song.path || "";
    let oldPath: string;
    let willUsePublicRelative = false;
    if (
      normalizedSongPath.startsWith("/music/") ||
      normalizedSongPath.startsWith("music/")
    ) {
      oldPath = path.join(publicRoot, normalizedSongPath.replace(/^\/?/, ""));
      willUsePublicRelative = true;
    } else if (path.isAbsolute(normalizedSongPath)) {
      oldPath = normalizedSongPath;
    } else {
      oldPath = path.join(publicRoot, normalizedSongPath.replace(/^\/?/, ""));
      willUsePublicRelative = true;
    }
    // keep dir the same as the old file to avoid moving between directories
    const oldDir = path.dirname(oldPath);
    const newPath = path.join(oldDir, finalName);
    let newDbPath: string;
    if (willUsePublicRelative && newPath.startsWith(publicRoot)) {
      newDbPath = `/${path.relative(publicRoot, newPath).replace(/\\/g, "/")}`;
    } else {
      newDbPath = newPath;
    }

    // Validate file exists
    try {
      await fs.access(oldPath);
    } catch (_err) {
      return NextResponse.json(
        { error: "Original file not found on disk" },
        { status: 404 },
      );
    }

    // Check if new filename exists
    try {
      await fs.access(newPath);
      return NextResponse.json(
        { error: "Target filename already exists" },
        { status: 409 },
      );
    } catch (_err) {
      // expected, continue
    }

    try {
      await fs.rename(oldPath, newPath);
    } catch (err: unknown) {
      // If rename fails across devices, fall back to copy + unlink
      const e = err as { code?: string };
      if (e.code === "EXDEV") {
        await fs.copyFile(oldPath, newPath);
        await fs.unlink(oldPath);
      } else {
        throw err;
      }
    }

    await db.update(songs).set({ path: newDbPath }).where(eq(songs.id, id));
    // Emit socket event so clients can refresh
    const [updated] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (global.io) global.io.emit("song:updated", updated);

    return NextResponse.json({ success: true, path: newDbPath });
  } catch (error) {
    console.error("Error renaming file:", error);
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 },
    );
  }
}
