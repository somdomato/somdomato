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

function parseFilenameToArtistTitle(filename: string) {
  // Prefer more explicit separators such as " - " (space-hyphen-space)
  const separators = [" - ", " — ", " – ", "—", "–", " -", "- ", "-"];
  for (const sep of separators) {
    if (filename.includes(sep)) {
      const parts = filename.split(sep).map((p) => p.trim());
      const artist = parts[0] || "";
      const title = parts.slice(1).join(sep).trim() || "";
      return { artist, title };
    }
  }
  // If no obvious separator is found, fallback to returning filename as title
  return { artist: "", title: filename };
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
    console.log(`[seed] processing: ${song}`);
    // Promisify NodeID3.read callback so we can await and ensure the script
    // doesn't exit before all files are processed.
    const readTags = (filePath: string) =>
      new Promise<Tag | null>((resolve) => {
        NodeID3.read(filePath, (err: Error | null, tags: Tag) => {
          if (err) return resolve(null);
          resolve(tags || null);
        });
      });

    const tags = await readTags(song as string);
    if (!tags) {
      // No tags or error reading tags; continue but treat as 'no tags' branch
    }

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
      let songDbPath = resolvedSongPath; // consistently store resolved absolute filesystem path
      let title: string;
      let artist: string;
      let detectedTitleFromFilename = "";
      let detectedArtistFromFilename = "";
      let cover: string | null = null;

      const sep = "-";

      // Extrair capa se existir
      try {
        cover = await extractAndSaveCover(song);
      } catch (error) {
        console.error(`Erro ao extrair capa de ${song}:`, error);
      }

      // Treat as tagged only when at least one of title/artist is present.
      const hasTags = Boolean(tags && (tags.title || tags.artist));
      const tagTitle = String(tags?.title ?? "");
      const tagArtist = String(tags?.artist ?? "");
      // Try to detect artist/title from filename if tags are missing or incomplete
      const fileParsed = parseFilenameToArtistTitle(filename);
      detectedArtistFromFilename = fileParsed.artist;
      detectedTitleFromFilename = fileParsed.title;
      if (hasTags) {
        const tagKey = normalizeString(`${tagTitle}-${tagArtist}`);
        // Check duplicates against DB
        if (
          (existingFilenameMap.has(filenameKey) &&
            existingFilenameMap.get(filenameKey) !== resolvedSongPath) ||
          (seenFilename.has(filenameKey) &&
            seenFilename.get(filenameKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by filename: ${song} matches ${existingFilenameMap.get(filenameKey) || seenFilename.get(filenameKey)} (filenameKey=${filenameKey})`,
          );
          return;
        }
        if (
          (existingTagMap.has(tagKey) &&
            existingTagMap.get(tagKey) !== resolvedSongPath) ||
          (seenTag.has(tagKey) && seenTag.get(tagKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by tags: ${song} matches ${existingTagMap.get(tagKey) || seenTag.get(tagKey)} (tagKey=${tagKey})`,
          );
          return;
        }
        artist = tagArtist
          ? parse(tagArtist).name
          : detectedArtistFromFilename || filename.slice(0, filename.indexOf(sep));
        title = tagTitle
          ? parse(tagTitle).name
          : detectedTitleFromFilename || filename.slice(0, filename.lastIndexOf(sep));
        songDbPath = String(song);
        // mark seen
        seenFilename.set(filenameKey, resolvedSongPath);
        seenTag.set(normalizeString(`${tagTitle}-${tagArtist}`), resolvedSongPath);
        // Upsert metadata when path conflict occurs; otherwise insert a new row
        await db
          .insert(songs)
          .values({ title, artist, path: songDbPath, cover })
          .onConflictDoUpdate({
            target: songs.path,
            set: { title, artist, cover },
          });
        console.log(`[seed] upserted: ${song} -> title="${title}" artist="${artist}"`);
      } else {
        const tagKey = normalizeString(`${filename}`);
        if (
          (existingFilenameMap.has(filenameKey) &&
            existingFilenameMap.get(filenameKey) !== resolvedSongPath) ||
          (seenFilename.has(filenameKey) &&
            seenFilename.get(filenameKey) !== resolvedSongPath)
        ) {
          console.warn(
            `[seed] Duplicate detected by filename: ${song} matches ${existingFilenameMap.get(filenameKey) || seenFilename.get(filenameKey)} (filenameKey=${filenameKey})`,
          );
          return;
        }
        artist = detectedArtistFromFilename || filename.slice(0, filename.indexOf(sep));
        title = detectedTitleFromFilename || filename.slice(0, filename.lastIndexOf(sep));
        songDbPath = String(song);
        await db
          .insert(songs)
          .values({ title, artist, path: songDbPath, cover })
          .onConflictDoUpdate({ target: songs.path, set: { title, artist, cover } });
        console.log(`[seed] upserted: ${song} -> title="${title}" artist="${artist}"`);

        seenFilename.set(filenameKey, resolvedSongPath);
          seenTag.set(tagKey, resolvedSongPath);
        }
  }
}

(async () => {
  await main();
})();
