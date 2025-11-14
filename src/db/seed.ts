import { getAllFilesRecursive, extractAndSaveCover } from "@/lib";
import { db } from "@/db";
import { songs } from "@/db/schema";
import NodeID3 from "node-id3";
import { parse } from "node:path";

interface Tag {
  title: string;
  artist: string;
  path: string;
  image?: {
    mime: string;
    imageBuffer: Buffer;
  };
}

async function main() {
  const musicFiles = await getAllFilesRecursive(process.env.MUSIC_PATH!);

  for await (const song of musicFiles) {
    NodeID3.read(song as string, async (err: Error | null, tags: Tag) => {
      if (err) return null;

      const extension = parse(song).ext;
      if (
        ![".mp3", ".flac", ".wav", ".m4a", ".ogg"].includes(
          extension.toLowerCase(),
        )
      ) {
        return;
      }

      const filename = parse(song).name;
      let title: string;
      let artist: string;
      let path: string;
      let cover: string | null = null;

      const sep = "-";

      // Extrair capa se existir
      try {
        cover = await extractAndSaveCover(song);
      } catch (error) {
        console.error(`Erro ao extrair capa de ${song}:`, error);
      }

      if (tags) {
        artist = tags.artist
          ? parse(tags.artist).name
          : filename.slice(0, filename.indexOf(sep));
        title = tags.title
          ? parse(tags.title).name
          : filename.slice(0, filename.lastIndexOf(sep));
        path = song;
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path,
            cover,
          })
          .onConflictDoNothing();
      } else {
        artist = filename.slice(0, filename.indexOf(sep));
        title = filename.slice(0, filename.lastIndexOf(sep));
        path = song;
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path,
            cover,
          })
          .onConflictDoNothing();
      }
    });
  }
}

(async () => {
  await main();
})();
