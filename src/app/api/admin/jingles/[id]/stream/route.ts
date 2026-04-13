import { db } from "@/db";
import { jingles } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!id || Number.isNaN(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    const [jingle] = await db
      .select()
      .from(jingles)
      .where(eq(jingles.id, id))
      .limit(1);

    if (!jingle) {
      return Response.json({ error: "Vinheta não encontrada" }, { status: 404 });
    }

    if (!fs.existsSync(jingle.path)) {
      return Response.json(
        { error: "Arquivo não encontrado" },
        { status: 404 },
      );
    }

    const buffer = fs.readFileSync(jingle.path);
    const ext = path.extname(jingle.filename).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
    };

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeTypes[ext] || "audio/mpeg",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("/api/admin/jingles/[id]/stream error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
