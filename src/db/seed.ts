import { getAllFilesRecursive, extractAndSaveCover } from "@/lib";
import { db } from "@/db";
import { songs } from "@/db/schema";
import NodeID3 from "node-id3";
import { parse } from "node:path";
import path from "node:path";

interface Tag {
  title: string;
  artist: string;
  path: string;
  image?: {
    mime: string;
    imageBuffer: Buffer;
  };
}

function normalizeString(s?: string | null) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  const musicFiles = await getAllFilesRecursive(process.env.MUSIC_PATH!);

  // Build maps of existing songs in DB so we can detect duplicates ignoring accents
  const existingSongs = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      path: songs.path,
    })
    .from(songs);
  const existingFilenameMap = new Map<string, string>();
  const existingTagMap = new Map<string, string>();
  for (const s of existingSongs) {
    const filename = parse(s.path).name;
    const filenameKey = normalizeString(filename);
    let resolved: string;
    if (s.path.startsWith("/music/") || s.path.startsWith("music/")) {
      resolved = path.resolve(
        path.join(process.cwd(), "public", s.path.replace(/^\/?/, "")),
      );
    } else {
      resolved = path.resolve(String(s.path));
    }
    existingFilenameMap.set(filenameKey, resolved);
    const tagKey = normalizeString(`${s.title}-${s.artist}`);
    existingTagMap.set(tagKey, resolved);
  }

  const seenFilename = new Map<string, string>();
  const seenTag = new Map<string, string>();

  for await (const song of musicFiles) {
    NodeID3.read(song as string, async (err: Error | null, tags: Tag) => {
      if (err) return null;

      const extension = parse(song).ext;
      if (
        ![".mp3", ".flac", ".wav", ".m4a", ".ogg"].includes(
          extension.toLowerCase(),
        )
      )
        return;

      const filename = parse(song).name;
      const filenameKey = normalizeString(filename);
      const resolvedSongPath = path.resolve(song as string);
      let title: string;
      let artist: string;
      let songDbPath: string;
      let cover: string | null = null;

      const sep = "-";

      // Extrair capa se existir
      try {
        cover = await extractAndSaveCover(song);
      } catch (error) {
        console.error(`Erro ao extrair capa de ${song}:`, error);
      }

      if (tags) {
        const tagKey = normalizeString(
          `${tags.title || ""}-${tags.artist || ""}`,
        );
        // Check duplicates against DB
        if (
          (existingFilenameMap.has(filenameKey) &&
            existingFilenameMap.get(filenameKey) !== resolvedSongPath) ||
          (seenFilename.has(filenameKey) &&
            seenFilename.get(filenameKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by filename: ${song} matches ${existingFilenameMap.get(filenameKey) || seenFilename.get(filenameKey)}`,
          );
          return;
        }
        if (
          (existingTagMap.has(tagKey) &&
            existingTagMap.get(tagKey) !== resolvedSongPath) ||
          (seenTag.has(tagKey) && seenTag.get(tagKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by tags: ${song} matches ${existingTagMap.get(tagKey) || seenTag.get(tagKey)}`,
          );
          return;
        }
        artist = tags.artist
          ? parse(tags.artist).name
          : filename.slice(0, filename.indexOf(sep));
        title = tags.title
          ? parse(tags.title).name
          : filename.slice(0, filename.lastIndexOf(sep));
        songDbPath = String(song);
        // mark seen
        seenFilename.set(filenameKey, resolvedSongPath);
        seenTag.set(
          normalizeString(`${tags.title || ""}-${tags.artist || ""}`),
          resolvedSongPath,
        );
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path: songDbPath,
            cover,
          })
          .onConflictDoNothing();
      } else {
        const tagKey = normalizeString(`${filename}`);
        if (
          (existingFilenameMap.has(filenameKey) &&
            existingFilenameMap.get(filenameKey) !== resolvedSongPath) ||
          (seenFilename.has(filenameKey) &&
            seenFilename.get(filenameKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by filename: ${song} matches ${existingFilenameMap.get(filenameKey) || seenFilename.get(filenameKey)}`,
          );
          return;
        }
        artist = filename.slice(0, filename.indexOf(sep));
        title = filename.slice(0, filename.lastIndexOf(sep));
        songDbPath = String(song);
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path: songDbPath,
            cover,
          })
          .onConflictDoNothing();

        seenFilename.set(filenameKey, resolvedSongPath);
        seenTag.set(tagKey, resolvedSongPath);
      }
    });
  }
}

(async () => {
  await main();
})();
