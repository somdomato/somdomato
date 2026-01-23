import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";

const MUSIC_DIR = "/var/music/sdm";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".ogg", ".m4a", ".wav"];

async function scanMusicDirectory(): Promise<Set<string>> {
  const musicFiles = new Set<string>();

  async function scan(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            musicFiles.add(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao escanear diretório ${dir}:`, error);
    }
  }

  await scan(MUSIC_DIR);
  return musicFiles;
}

async function syncDatabase() {
  console.log("Escaneando diretório de músicas...");
  const filesOnDisk = await scanMusicDirectory();
  console.log(`Encontrados ${filesOnDisk.size} arquivos de música no disco.`);

  console.log("Carregando músicas do banco de dados...");
  const songsInDb = await db.select().from(songs);
  console.log(`Encontradas ${songsInDb.length} músicas no banco de dados.`);

  // Remover músicas do banco que não existem mais no disco
  let removedCount = 0;
  for (const song of songsInDb) {
    if (!filesOnDisk.has(song.path)) {
      console.log(`Removendo música inexistente: ${song.path}`);
      await db.delete(songs).where(eq(songs.id, song.id));
      removedCount++;
    }
  }

  console.log(`Total de músicas removidas: ${removedCount}`);

  // Adicionar músicas novas que estão no disco mas não no banco
  const pathsInDb = new Set(songsInDb.map((s) => s.path));
  let addedCount = 0;

  for (const filePath of filesOnDisk) {
    if (!pathsInDb.has(filePath)) {
      console.log(`Nova música encontrada: ${filePath}`);

      // Extrair informações básicas do nome do arquivo
      const fileName = path.basename(filePath, path.extname(filePath));
      let title = fileName;
      let artist = "Desconhecido";

      // Tentar separar artista - título
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      }

      try {
        await db.insert(songs).values({
          title,
          artist,
          path: filePath,
          timeSlots: 127, // Todos os horários por padrão (0b1111111)
          cover: null,
        });
        addedCount++;
      } catch (error) {
        console.error(`Erro ao adicionar música ${filePath}:`, error);
      }
    }
  }

  console.log(`Total de músicas adicionadas: ${addedCount}`);
  console.log("Sincronização concluída!");
}

syncDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro durante sincronização:", error);
    process.exit(1);
  });
