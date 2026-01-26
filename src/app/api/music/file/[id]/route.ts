import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

export async function GET(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  // Ensure params is available regardless of framework promise behavior
  const p = await (context.params as Promise<{ id: string }> | { id: string });
  const id = Number(p.id);

  try {
    const [s] = await db.select().from(songs).where(eq(songs.id, id));
    if (!s) return new Response(JSON.stringify({ error: "not_found", message: "song not found" }), { status: 404 });
    if (!s.path) return new Response(JSON.stringify({ error: "file_not_configured", message: "song has no path configured" }), { status: 404 });

    const filePath = s.path;

    // Ensure file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return new Response(JSON.stringify({ error: "file_not_found", message: "file path does not exist on disk", path: filePath }), { status: 404 });
    }

    try {
      const stat = await fsPromises.stat(filePath);
      const stream = fs.createReadStream(filePath);
      const headers = new Headers();
      headers.set("Content-Type", "audio/mpeg");
      headers.set("Content-Length", String(stat.size));
      headers.set("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
      headers.set("Accept-Ranges", "bytes");

      // Convert Node.js ReadStream to Web ReadableStream for Response body
      const { Readable } = await import("node:stream");
      const body = Readable.toWeb(stream as any);

      return new Response(body as unknown as BodyInit, { status: 200, headers });
    } catch (err) {
      console.error(`/api/music/file/${id} stream error:`, err);
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: "internal", message }), { status: 500 });
    }
  } catch (err) {
    console.error(`/api/music/file/${id} error:`, err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "internal", message }), { status: 500 });
  }
}
