import { NextRequest } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/var/music/uploads";

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/** Resolve symlinks on UPLOADS_DIR itself so path comparisons are consistent */
function getRealUploadsDir(): string {
  try {
    return fs.realpathSync(UPLOADS_DIR);
  } catch {
    return UPLOADS_DIR;
  }
}

/**
 * Recursively collect all audio files under `dir`.
 * Uses fs.statSync (follows symlinks) so symlinked subdirs are traversed.
 * Returns a Map of absolute path → mtime (ms).
 */
function getAllAudioFiles(dir: string): Map<string, number> {
  const results = new Map<string, number>();
  const recurse = (d: string) => {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        try {
          const stat = fs.statSync(full); // follows symlinks
          if (stat.isDirectory()) {
            recurse(full);
          } else if (/\.(mp3|flac|ogg|m4a)$/i.test(entry.name)) {
            results.set(full, stat.mtimeMs);
          }
        } catch {
          // skip unreadable entries
        }
      }
    } catch {
      // ignore unreadable dirs
    }
  };
  recurse(dir);
  return results;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: object) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const { trackId, title, artist, thumbnail } = body;

        if (!trackId || !title || !artist) {
          send({ error: "Missing required fields", done: true });
          return;
        }

        ensureUploadsDir();

        const realUploadsDir = getRealUploadsDir();
        const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const sanitizedArtist = artist.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const filename = `${sanitizedArtist} - ${sanitizedTitle}.mp3`;
        const outputPath = path.join(realUploadsDir, filename);

        send({
          status: "starting",
          progress: 0,
          message: "Iniciando download...",
        });

        const startMs = Date.now();

        // Snapshot before download (real paths, for new-file detection)
        const filesBefore = getAllAudioFiles(realUploadsDir);

        const godeezProcess = spawn(
          "godeez",
          ["download", "track", String(trackId)],
          { cwd: realUploadsDir },
        );

        let lastProgress = 5;
        const parseProgress = (output: string) => {
          const match = output.match(/(\d+(?:\.\d+)?)\s*%/);
          if (match) {
            const percent = Math.min(89, Math.round(parseFloat(match[1])));
            if (percent > lastProgress) {
              lastProgress = percent;
              send({
                status: "downloading",
                progress: percent,
                message: `Baixando: ${percent}%`,
              });
            }
          }
        };

        let stderr = "";
        let stdout = "";
        godeezProcess.stdout?.on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          stdout += output;
          parseProgress(output);
        });

        godeezProcess.stderr?.on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          stderr += output;
          parseProgress(output);
        });

        const exitCode = await new Promise<number>((resolve, reject) => {
          godeezProcess.on("close", (code) => resolve(code ?? 0));
          godeezProcess.on("error", reject);
        });

        if (exitCode !== 0) {
          console.warn(
            `godeez exited with code ${exitCode}. stdout: ${stdout} stderr: ${stderr}`,
          );
        }

        send({ status: "processing", progress: 90, message: "Processando..." });

        // Small delay to ensure the file is fully flushed to disk
        await new Promise((r) => setTimeout(r, 500));

        // Find newly downloaded file:
        // Primary: file path not in the before-snapshot
        // Fallback: file with mtime >= startMs (handles edge cases with temp files)
        const filesAfter = getAllAudioFiles(realUploadsDir);
        const newFiles = [...filesAfter.keys()].filter(
          (f) => !filesBefore.has(f),
        );
        const recentFiles =
          newFiles.length > 0
            ? newFiles
            : [...filesAfter.entries()]
                .filter(([, mtime]) => mtime >= startMs)
                .map(([f]) => f);

        if (recentFiles.length === 0) {
          console.error(
            `godeez: no new audio file found. realUploadsDir=${realUploadsDir} stdout=${stdout} stderr=${stderr}`,
          );
          send({ error: "Arquivo não encontrado após download", done: true });
          return;
        }

        // Pick the most recently modified file
        const downloadedPath = recentFiles.sort((a, b) => {
          return (filesAfter.get(b) ?? 0) - (filesAfter.get(a) ?? 0);
        })[0];

        // Move to UPLOADS_DIR root with standardized filename
        if (downloadedPath !== outputPath) {
          fs.renameSync(downloadedPath, outputPath);
        }

        // Save to database
        await db.insert(uploads).values({
          title,
          artist,
          deezerUrl: `https://www.deezer.com/track/${trackId}`,
          deezerId: String(trackId),
          thumbnail: thumbnail || null,
          filename,
          path: outputPath,
          status: "pending",
        });

        send({
          status: "complete",
          progress: 100,
          message: "Download concluído! Aguardando moderação.",
          done: true,
        });
      } catch (error) {
        console.error("Download error:", error);
        send({
          error: error instanceof Error ? error.message : "Download failed",
          done: true,
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
