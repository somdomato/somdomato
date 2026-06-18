import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import { resolveSongCover, validateCoverForDb } from "@/lib/cover";
import { setCurrent } from "@/lib/queue";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { songId } = body;

    const s = await db
      .select()
      .from(songs)
      .where(eq(songs.id, Number(songId)))
      .limit(1)
      .get();
    if (!s)
      return new Response(JSON.stringify({ error: "song not found" }), {
        status: 404,
      });

    // make sure file exists
    try {
      await fs.access(s.path);
    } catch {
      return new Response(JSON.stringify({ error: "file not found on disk" }), {
        status: 400,
      });
    }

    // Registrar como "current" no banco (rebaixa a current anterior do
    // mesmo gênero para "played" na mesma transação)
    await setCurrent({
      genre: s.genre || "geral",
      songId: s.id,
      source: "admin",
    });

    // ensure cover is present in DB (best-effort)
    let resolvedCover = s.cover ?? null;
    try {
      const valid = await validateCoverForDb(s.cover);
      if (!valid) {
        const found = await resolveSongCover({
          mp3Path: s.path,
          artist: s.artist,
          title: s.title,
        });
        const verified = await validateCoverForDb(found);
        if (verified && verified !== s.cover) {
          await db
            .update(songs)
            .set({ cover: verified })
            .where(eq(songs.id, s.id));
        }
        resolvedCover = verified;
      } else {
        resolvedCover = valid;
      }
    } catch (err) {
      console.error("Erro ao garantir capa:", err);
    }

    const selectedSong = {
      id: s.id,
      title: s.title,
      artist: s.artist,
      path: s.path,
      cover: resolvedCover,
      timeSlots: s.timeSlots,
      createdAt: s.createdAt,
      genre: s.genre,
      allowedInGeneral: s.allowedInGeneral,
    };

    // Injetar música no Liquidsoap via endpoint HTTP (harbor.http na porta 8080)
    const controlUrl =
      process.env.LIQUIDSOAP_CONTROL_URL || "http://localhost:8080";
    try {
      const liqRes = await fetch(`${controlUrl}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: s.path,
          title: s.title,
          artist: s.artist,
        }),
      });
      if (!liqRes.ok) {
        const text = await liqRes.text();
        console.error("Liquidsoap /play retornou erro:", text);
        return new Response(
          JSON.stringify({ error: "Liquidsoap recusou a injeção" }),
          { status: 502 },
        );
      }
      console.log("Música injetada no Liquidsoap com sucesso");
    } catch (err) {
      console.error("Falha ao conectar com Liquidsoap:", err);
      return new Response(
        JSON.stringify({ error: "Não foi possível conectar ao Liquidsoap" }),
        { status: 502 },
      );
    }

    // Emitir evento de socket após confirmação do Liquidsoap
    if (global.io)
      global.io.emit("song:changed", {
        id: selectedSong.id,
        title: selectedSong.title,
        artist: selectedSong.artist,
        cover: resolvedCover,
        genre: selectedSong.genre || "geral",
        allowedInGeneral: selectedSong.allowedInGeneral || 0,
        playedAt: Date.now(),
        playedOnMountpoint: selectedSong.genre || "geral",
        wasRequested: false,
      });

    return new Response(JSON.stringify({ success: true, song: selectedSong }), {
      status: 200,
    });
  } catch (error) {
    console.error("/api/admin/play error:", error);
    const message = error instanceof Error ? error.message : "failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
