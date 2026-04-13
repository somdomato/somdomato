import { db } from "@/db";
import { jingles } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!id || Number.isNaN(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.active === "number") {
      updates.active = body.active;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    await db.update(jingles).set(updates).where(eq(jingles.id, id));
    return Response.json({ success: true });
  } catch (err) {
    console.error("/api/admin/jingles/[id] PATCH error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    // Delete file from disk
    try {
      if (fs.existsSync(jingle.path)) {
        fs.unlinkSync(jingle.path);
      }
    } catch (err) {
      console.error("Erro ao deletar arquivo da vinheta:", err);
    }

    await db.delete(jingles).where(eq(jingles.id, id));
    return Response.json({ success: true });
  } catch (err) {
    console.error("/api/admin/jingles/[id] DELETE error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
