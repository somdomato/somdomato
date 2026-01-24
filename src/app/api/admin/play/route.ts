import { db } from "@/db";
import { songs, history } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { extractAndSaveCover, findCoverByArtist } from "@/lib/cover";

async function verifyAdmin(password?: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || password !== adminPassword) throw new Error("Senha inválida");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId, password } = body;

    await verifyAdmin(password);

    const s = await db.select().from(songs).where(eq(songs.id, Number(songId))).limit(1).get();
    if (!s) return new Response(JSON.stringify({ error: "song not found" }), { status: 404 });

    // make sure file exists
    try {
      await fs.access(s.path);
    } catch (err) {
      return new Response(JSON.stringify({ error: "file not found on disk" }), { status: 400 });
    }

    // insert into history
    await db.insert(history).values({ songId: s.id }).returning();

    // ensure cover is present in DB (best-effort)
    try {
      let coverPath = s.cover ?? null;

      if (coverPath) {
        // confirm physical file exists
        const coverFsPath = `${process.cwd()}/public/${coverPath.replace(/^\/+/, "")}`;
        try {
          await fs.access(coverFsPath);
        } catch {
          coverPath = null;
        }
      }

      if (!coverPath) {
        try {
          const extracted = await extractAndSaveCover(s.path);
          if (extracted) coverPath = extracted;
        } catch (err) {
          console.error("Erro ao extrair capa:", err);
        }
      }

      if (!coverPath) {
        const found = await findCoverByArtist(s.artist);
        if (found) coverPath = found;
      }

      if (coverPath && coverPath !== s.cover) {
        await db.update(songs).set({ cover: coverPath }).where(eq(songs.id, s.id));
      }
    } catch (err) {
      console.error("Erro ao garantir capa:", err);
    }

    // emit socket event
    const selectedSong = {
      id: s.id,
      title: s.title,
      artist: s.artist,
      path: s.path,
      cover: s.cover || null,
      timeSlots: s.timeSlots,
      createdAt: s.createdAt,
    };

    if ((global as any).io) (global as any).io.emit("song:changed", selectedSong);

    // try to call liquidsoap control endpoint to skip immediately (optional)
    const controlUrl = process.env.LIQUIDSOAP_CONTROL_URL;
    if (controlUrl) {
      try {
        await fetch(`${controlUrl}/skip`, { method: "POST" }).catch((e) => console.error("liquidsoap skip call failed", e));
      } catch (err) {
        console.error("Error calling liquidsoap control endpoint:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, song: selectedSong }), { status: 200 });
  } catch (error) {
    console.error("/api/admin/play error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "failed" }), { status: 500 });
  }
}
