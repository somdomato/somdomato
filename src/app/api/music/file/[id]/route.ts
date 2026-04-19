import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

// Known music path patterns to replace with MUSIC_PATH
const KNOWN_MUSIC_PATHS = ["/var/music/sdm", "/home/lucas/music/sdm"];

/**
 * Converts a stored database path to the actual filesystem path
 * using the MUSIC_PATH environment variable
 */
function resolveMusicPath(storedPath: string): string {
  const musicPath = process.env.MUSIC_PATH;
  if (!musicPath) {
    return storedPath; // No conversion if MUSIC_PATH not set
  }

  // Try to replace any known path prefix with MUSIC_PATH
  for (const knownPath of KNOWN_MUSIC_PATHS) {
    if (storedPath.startsWith(knownPath)) {
      return storedPath.replace(knownPath, musicPath);
    }
  }

  return storedPath;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const p = await context.params;
  const id = Number(p.id);

  try {
    const [s] = await db.select().from(songs).where(eq(songs.id, id));
    if (!s)
      return new Response(
        JSON.stringify({ error: "not_found", message: "song not found" }),
        { status: 404 },
      );
    if (!s.path)
      return new Response(
        JSON.stringify({
          error: "file_not_configured",
          message: "song has no path configured",
        }),
        { status: 404 },
      );

    // Resolve the actual filesystem path
    const filePath = resolveMusicPath(s.path);

    // Ensure file exists
    try {
      await fsPromises.access(filePath);
    } catch {
      return new Response(
        JSON.stringify({
          error: "file_not_found",
          message: "file path does not exist on disk",
          storedPath: s.path,
          resolvedPath: filePath,
          musicPathEnv: process.env.MUSIC_PATH || "(not set)",
        }),
        { status: 404 },
      );
    }

    try {
      const stat = await fsPromises.stat(filePath);
      const fileSize = stat.size;
      const basename = path.basename(filePath);
      const asciiName = basename.replaceAll(/[^\x20-\x7E]/g, "_");
      const encodedName = encodeURIComponent(basename);

      const headers = new Headers();
      headers.set("Content-Type", "audio/mpeg");
      headers.set(
        "Content-Disposition",
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      );
      headers.set("Accept-Ranges", "bytes");

      // Handle Range requests (browsers use this for audio seeking)
      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          const start = match[1] ? Number.parseInt(match[1], 10) : 0;
          const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

          if (start >= fileSize || end >= fileSize || start > end) {
            return new Response(null, {
              status: 416,
              headers: { "Content-Range": `bytes */${fileSize}` },
            });
          }

          const chunkSize = end - start + 1;
          const stream = fs.createReadStream(filePath, { start, end });
          const { Readable } = await import("node:stream");
          const body = Readable.toWeb(stream);

          headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          headers.set("Content-Length", String(chunkSize));

          return new Response(body as BodyInit, { status: 206, headers });
        }
      }

      // Full file response
      headers.set("Content-Length", String(fileSize));
      const stream = fs.createReadStream(filePath);
      const { Readable } = await import("node:stream");
      const body = Readable.toWeb(stream);

      return new Response(body as BodyInit, { status: 200, headers });
    } catch (err) {
      console.error(`/api/music/file/${id} stream error:`, err);
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: "internal", message }), {
        status: 500,
      });
    }
  } catch (err) {
    console.error(`/api/music/file/${id} error:`, err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "internal", message }), {
      status: 500,
    });
  }
}
