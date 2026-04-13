import { db } from "@/db";
import { jingles, settings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const MUSIC_PATH = process.env.MUSIC_PATH || "/var/music/sdm";
const JINGLES_DIR = path.join(MUSIC_PATH, "vinhetas");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "25");
    const offset = (page - 1) * limit;

    const allJingles = await db
      .select()
      .from(jingles)
      .orderBy(desc(jingles.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: db.$count(jingles) })
      .from(jingles);
    const total = Number(countResult?.count || 0);

    // Get interval setting
    const intervalSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "jingle_interval"))
      .get();

    return Response.json({
      items: allJingles,
      total,
      pages: Math.ceil(total / limit),
      page,
      jingleInterval: intervalSetting ? Number(intervalSetting.value) : 5,
    });
  } catch (err) {
    console.error("/api/admin/jingles GET error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string)?.trim();

    if (!file || !title) {
      return Response.json(
        { error: "Arquivo e título são obrigatórios" },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/x-wav",
      "audio/x-m4a",
      "audio/mp4",
      "audio/aac",
    ];
    if (
      !allowedTypes.includes(file.type) &&
      !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
    ) {
      return Response.json(
        { error: "Formato de áudio não suportado" },
        { status: 400 },
      );
    }

    // Max 30 seconds (10MB as a generous limit)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "Arquivo muito grande (máx 10MB)" },
        { status: 400 },
      );
    }

    ensureDir(JINGLES_DIR);

    // Sanitize filename
    const ext = path.extname(file.name) || ".mp3";
    const safeName = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const filename = `${safeName}-${Date.now()}${ext}`;
    const filePath = path.join(JINGLES_DIR, filename);

    // Ensure the path is within JINGLES_DIR (path traversal protection)
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(JINGLES_DIR);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      return Response.json({ error: "Caminho inválido" }, { status: 400 });
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Get duration using ffprobe if available
    let duration: number | null = null;
    try {
      const { execSync } = await import("node:child_process");
      const result = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { encoding: "utf-8", timeout: 5000 },
      ).trim();
      duration = Math.round(Number.parseFloat(result));
    } catch {
      // ffprobe not available, skip duration
    }

    const [inserted] = await db
      .insert(jingles)
      .values({
        title,
        filename,
        path: filePath,
        duration,
      })
      .returning({ id: jingles.id });

    return Response.json({ success: true, id: inserted.id });
  } catch (err) {
    console.error("/api/admin/jingles POST error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
