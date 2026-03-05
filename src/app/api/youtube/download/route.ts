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
const COOKIES_FILE = process.env.COOKIES_FILE || "/var/lib/youtube_cookies.txt";

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

        const ytDlpWrap = new YTDlpWrap("/usr/local/bin/yt-dlp"); // Ajuste para o caminho do yt-dlp no seu sistema

        // Build yt-dlp arguments with anti-bot workarounds
        const ytDlpArgs = [
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
          // Anti-bot workarounds
          "--extractor-args",
          "youtube:player_client=web",
          "--no-cache-dir",
          "--force-ipv4",
          "--user-agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ];

        // Add cookies if file exists (required for bot detection bypass)
        if (fs.existsSync(COOKIES_FILE)) {
          ytDlpArgs.push("--cookies", COOKIES_FILE);
          console.log(`Using cookies from: ${COOKIES_FILE}`);
        } else {
          console.warn(`Cookies file not found: ${COOKIES_FILE}`);
        }

        // Download as MP3
        const ytDlpProcess = ytDlpWrap.exec(ytDlpArgs);

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
