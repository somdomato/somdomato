import { getAllFilesRecursive, extractAndSaveCover } from "@/lib";
import { db } from "@/db";
import { songs } from "@/db/schema";
import NodeID3 from "node-id3";

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
        artist = tags.artist || song.slice(0, song.indexOf(sep));
        title = tags.title || song.slice(0, song.lastIndexOf(sep));
        path = song;
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path,
            cover
          })
          .onConflictDoNothing();
      } else {
        artist = song.slice(0, song.indexOf(sep));
        title = song.slice(0, song.lastIndexOf(sep));
        path = song;
        await db
          .insert(songs)
          .values({
            title,
            artist,
            path,
            cover
          })
          .onConflictDoNothing();
      }
    });
  }
}

(async () => {
  await main();
})();
