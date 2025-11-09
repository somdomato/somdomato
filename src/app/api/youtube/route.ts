import { NextResponse } from "next/server";
import { YtDlp } from "ytdlp-nodejs";
import path from "node:path";
import fs from "node:fs";

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "URL não fornecida." }, { status: 400 });
  }

  try {
    const outputDir = path.join(process.cwd(), "public", "music");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const ytdlp = new YtDlp({
      binaryPath: process.env.YTDLP_PATH || "/usr/local/bin/yt-dlp",
      ffmpegPath: process.env.FFMPEG_PATH || "/usr/local/bin/ffmpeg",
    });
    // Gera nome único para evitar conflitos
    const fileName = `music_${Date.now()}.mp3`;
    const outputPath = path.join(outputDir, fileName);

    await ytdlp.downloadAsync(url, {
      // cookies: process.env.YTDLP_COOKIES_PATH || undefined,
      output: outputPath,
      format: "mp3",
    });

    return NextResponse.json({ success: true, file: `/music/${fileName}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
