import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads, songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const MUSIC_PATH = process.env.MUSIC_PATH || "/var/music/sdm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uploadId = parseInt(id, 10);

  if (Number.isNaN(uploadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, genre } = body;

    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Move file to music directory
      const destPath = path.join(MUSIC_PATH, upload.filename);

      if (!fs.existsSync(upload.path)) {
        return NextResponse.json(
          {
            error:
              "Arquivo não encontrado no servidor. O upload pode ter sido removido.",
          },
          { status: 404 },
        );
      }

      if (!fs.existsSync(MUSIC_PATH)) {
        fs.mkdirSync(MUSIC_PATH, { recursive: true });
      }

      fs.copyFileSync(upload.path, destPath);
      fs.unlinkSync(upload.path);

      // Extract and save cover from MP3
      let coverPath = "/images/logotipo.svg";
      try {
        const { extractAndSaveCover, checkExistingCover } = await import(
          "@/lib/cover"
        );
        const extracted = await extractAndSaveCover(destPath, upload.artist);
        if (extracted) {
          coverPath = extracted;
        } else {
          const found = await checkExistingCover(upload.artist);
          if (found) {
            coverPath = found;
          }
        }
      } catch (err) {
        console.error("Erro ao extrair capa:", err);
      }

      // Add to songs table
      await db.insert(songs).values({
        title: upload.title,
        artist: upload.artist,
        path: destPath,
        cover: coverPath,
        genre: genre || "geral",
        rotation: "normal",
        timeSlots: 15,
      });

      // Update upload status
      await db
        .update(uploads)
        .set({ status: "approved" })
        .where(eq(uploads.id, uploadId));

      return NextResponse.json({ success: true, message: "Upload approved" });
    }

    if (action === "reject") {
      // Delete file
      if (fs.existsSync(upload.path)) {
        fs.unlinkSync(upload.path);
      }

      // Update upload status
      await db
        .update(uploads)
        .set({ status: "rejected" })
        .where(eq(uploads.id, uploadId));

      return NextResponse.json({ success: true, message: "Upload rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating upload:", error);
    return NextResponse.json(
      { error: "Failed to update upload" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const uploadId = parseInt(id, 10);

  if (Number.isNaN(uploadId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, uploadId))
      .limit(1);

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    // Delete file if exists
    if (fs.existsSync(upload.path)) {
      fs.unlinkSync(upload.path);
    }

    // Delete from database
    await db.delete(uploads).where(eq(uploads.id, uploadId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 },
    );
  }
}
