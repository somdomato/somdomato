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

    const oldPath = path.join(
      process.cwd(),
      "public",
      song.path.replace(/^\/?/, ""),
    );
    const newRelative = `/music/${finalName}`;
    const newPath = path.join(
      process.cwd(),
      "public",
      newRelative.replace(/^\/?/, ""),
    );

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

    await fs.rename(oldPath, newPath);

    await db.update(songs).set({ path: newRelative }).where(eq(songs.id, id));
    // Emit socket event so clients can refresh
    const [updated] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (global.io) global.io.emit("song:updated", updated);

    return NextResponse.json({ success: true, path: newRelative });
  } catch (error) {
    console.error("Error renaming file:", error);
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 },
    );
  }
}
