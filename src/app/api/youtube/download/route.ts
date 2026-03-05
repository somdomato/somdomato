import { NextRequest } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import YTDlpWrap from "yt-dlp-wrap";
import path from "node:path";
import fs from "node:fs";

interface YtDlpProgress {
  percent?: number;
  totalSize?: string;
  currentSpeed?: string;
  eta?: string;
}

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/var/music/uploads";

// Ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const { videoId, title, artist, thumbnail, url } = body;

        if (!videoId || !title || !artist) {
          send({ error: "Missing required fields", done: true });
          controller.close();
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

        const ytDlpWrap = new YTDlpWrap();

        // Download as MP3
        const ytDlpProcess = ytDlpWrap.exec([
          url || `https://www.youtube.com/watch?v=${videoId}`,
          "-x",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "-o",
          outputPath,
          "--no-playlist",
          "--newline",
        ]);

        ytDlpProcess.on("progress", (progress: YtDlpProgress) => {
          send({
            status: "downloading",
            progress: Math.round(progress.percent || 0),
            message: `Baixando: ${Math.round(progress.percent || 0)}%`,
          });
        });

        ytDlpProcess.on(
          "ytDlpEvent",
          (eventType: string, eventData: string) => {
            if (eventType === "download") {
              const match = eventData.match(/(\d+\.?\d*)%/);
              if (match) {
                const percent = parseFloat(match[1]);
                send({
                  status: "downloading",
                  progress: Math.round(percent),
                  message: `Baixando: ${Math.round(percent)}%`,
                });
              }
            }
          },
        );

        await new Promise<void>((resolve, reject) => {
          ytDlpProcess.on("close", () => resolve());
          ytDlpProcess.on("error", (err: Error) => reject(err));
        });

        send({ status: "processing", progress: 90, message: "Processando..." });

        // Save to database
        await db.insert(uploads).values({
          title,
          artist,
          youtubeUrl: url || `https://www.youtube.com/watch?v=${videoId}`,
          youtubeId: videoId,
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
