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

function getAllAudioFiles(dir: string): Set<string> {
  const results = new Set<string>();
  const recurse = (d: string) => {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) recurse(full);
        else if (/\.(mp3|flac|ogg|m4a)$/i.test(entry.name)) results.add(full);
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

        const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const sanitizedArtist = artist.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
        const filename = `${sanitizedArtist} - ${sanitizedTitle}.mp3`;
        const outputPath = path.join(UPLOADS_DIR, filename);

        send({
          status: "starting",
          progress: 0,
          message: "Iniciando download...",
        });

        // Snapshot files before download to detect newly created file
        const filesBefore = getAllAudioFiles(UPLOADS_DIR);

        const godeezProcess = spawn(
          "godeez",
          ["download", "track", String(trackId)],
          { cwd: UPLOADS_DIR },
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

        godeezProcess.stdout?.on("data", (chunk: Buffer) => {
          parseProgress(chunk.toString());
        });

        let stderr = "";
        godeezProcess.stderr?.on("data", (chunk: Buffer) => {
          const output = chunk.toString();
          stderr += output;
          parseProgress(output);
        });

        await new Promise<void>((resolve, reject) => {
          godeezProcess.on("close", (code) => {
            if (code === 0) resolve();
            else
              reject(new Error(`godeez exited with code ${code}: ${stderr}`));
          });
          godeezProcess.on("error", reject);
        });

        send({ status: "processing", progress: 90, message: "Processando..." });

        // Find the newly downloaded file (recursive — godeez may create subdirs)
        const filesAfter = getAllAudioFiles(UPLOADS_DIR);
        const newFiles = [...filesAfter].filter((f) => !filesBefore.has(f));

        if (newFiles.length === 0) {
          send({ error: "Arquivo não encontrado após download", done: true });
          return;
        }

        const downloadedPath = newFiles[0];

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
