import path from "node:path";
import NodeID3 from "node-id3";
import { getAllFilesRecursive, extractAndSaveCover } from "@/lib";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { parse } from "node:path";
import { eq } from "drizzle-orm";

export function normalizeString(s?: string | null) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function parseFilenameToArtistTitle(filename: string) {
  const separators = [" - ", " — ", " – ", "—", "–", " -", "- ", "-"];
  for (const sep of separators) {
    if (filename.includes(sep)) {
      const parts = filename.split(sep).map((p) => p.trim());
      const artist = parts[0] || "";
      const title = parts.slice(1).join(sep).trim() || "";
      return { artist, title };
    }
  }
  return { artist: "", title: filename };
}

export const readTags = (filePath: string) =>
  new Promise<{ title?: string; artist?: string } | null>((resolve) => {
    NodeID3.read(filePath, (err: Error | null, tags: unknown) => {
      if (err) return resolve(null);
      const t = tags as { title?: string; artist?: string } | null;
      resolve({ title: t?.title, artist: t?.artist });
    });
  });

export async function upsertSongFromFile(filePath: string) {
  // resolve absolute path used in DB for consistency
  const resolved = path.resolve(filePath);
  // check if file is one of expected extensions
  const ext = parse(resolved).ext.toLowerCase();
  if (![".mp3", ".flac", ".wav", ".m4a", ".ogg"].includes(ext)) return { skipped: true, reason: "unsupported-ext" };

  // Read tags
  const tags = await readTags(resolved);
  const tagTitle = String(tags?.title ?? "");
  const tagArtist = String(tags?.artist ?? "");

  // parse filename
  const filename = parse(resolved).name || "";
  const parsed = parseFilenameToArtistTitle(filename);
  const detectedArtistFromFilename = parsed.artist;
  const detectedTitleFromFilename = parsed.title;

  // Extract cover if possible (best-effort)
  let cover: string | null = null;
  try {
    cover = await extractAndSaveCover(resolved);
  } catch (_err) {
    // continue without cover
  }

  // Determine title/artist
  const artist = tagArtist ? tagArtist : detectedArtistFromFilename || "";
  const title = tagTitle ? tagTitle : detectedTitleFromFilename || filename;

  // Decide whether we will create a new row or update an existing one
  const [existing] = await db.select().from(songs).where(eq(songs.path, resolved)).limit(1);
  const isExisting = Boolean(existing);

  // Insert or update
  await db
    .insert(songs)
    .values({ title, artist, path: resolved, cover })
    .onConflictDoUpdate({ target: songs.path, set: { title, artist, cover } });

  return { skipped: false, insertedOrUpdated: true, title, artist, existedBefore: isExisting };
}

export async function scanAndUpsertAllFiles(musicPath: string) {
  const files = await getAllFilesRecursive(musicPath);
  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  for await (const file of files) {
    const res = await upsertSongFromFile(file);
    if (res?.skipped) skippedCount++;
    else if (res) {
      if (res.existedBefore) updatedCount++;
      else newCount++;
    }
  }
  return { processed: files.length, newOrUpdated: newCount, updated: updatedCount, skipped: skippedCount };
}

export default {
  normalizeString,
  parseFilenameToArtistTitle,
  readTags,
  upsertSongFromFile,
  scanAndUpsertAllFiles,
};
