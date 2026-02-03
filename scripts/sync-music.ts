import { db } from "@/db";
import { songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import NodeID3 from "node-id3";

const MUSIC_DIR = "/var/music/sdm";
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".ogg", ".m4a", ".wav"];

// Gêneros válidos do sistema
const VALID_GENRES = ["Sertanejo", "Sertanejo Gaúcho", "Modão", "Arrocha", "Romântico", "Forró"];

// Mapeamento de gêneros ID3 para banco de dados
// IMPORTANTE: "Sertanejo" no ID3 vira "geral" no banco
const GENRE_ID3_TO_DB: Record<string, string> = {
  "Sertanejo": "geral",
  "Sertanejo Gaúcho": "gaucha",
  "Modão": "modao",
  "Arrocha": "arrocha",
  "Romântico": "romantico",
  "Forró": "forro"
};

async function scanMusicDirectory(): Promise<Set<string>> {
  const musicFiles = new Set<string>();
  const visited = new Set<string>(); // armazena paths reais já visitados para evitar loops

  async function scan(dir: string) {
    let realDir: string;
    try {
      realDir = await fs.realpath(dir);
    } catch (error) {
      console.error(`Erro ao resolver realpath ${dir}:`, error);
      return; // se não conseguimos resolver, não seguimos
    }

    if (visited.has(realDir)) return; // já visitado -> evita loop
    visited.add(realDir);

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Ignorar symlinks problemáticos que possam causar loops (avisar no log)
        if (entry.isSymbolicLink()) {
          try {
            const targetReal = await fs.realpath(fullPath);
            if (visited.has(targetReal)) continue; // evita seguir para local já visitado
          } catch (err) {
            console.warn(`Ignorando symlink problemático ${fullPath}:`, err);
            continue;
          }
        }

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

/**
 * Lê tags ID3 de forma assíncrona
 */
function readID3Tags(filePath: string): Promise<NodeID3.Tags | null> {
  return new Promise((resolve) => {
    // Apenas MP3 suporta ID3 tags completas
    if (!filePath.toLowerCase().endsWith('.mp3')) {
      resolve(null);
      return;
    }
    
    NodeID3.read(filePath, (err: Error | null, tags: NodeID3.Tags) => {
      if (err) {
        console.warn(`Erro ao ler ID3 tags de ${filePath}:`, err.message);
        resolve(null);
        return;
      }
      resolve(tags || null);
    });
  });
}

/**
 * Atualiza tags ID3 de um arquivo MP3
 */
function updateID3Tags(filePath: string, tags: NodeID3.Tags): boolean {
  if (!filePath.toLowerCase().endsWith('.mp3')) {
    return false;
  }
  
  try {
    const success = NodeID3.update(tags, filePath);
    return success === true;
  } catch (err) {
    console.error(`Erro ao atualizar ID3 tags de ${filePath}:`, err);
    return false;
  }
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
  let id3UpdatedCount = 0;

  for (const filePath of filesOnDisk) {
    if (!pathsInDb.has(filePath)) {
      console.log(`Nova música encontrada: ${filePath}`);

      // Ler tags ID3 se for MP3
      const id3Tags = await readID3Tags(filePath);
      
      // Extrair informações do ID3 ou do nome do arquivo
      let title = id3Tags?.title || "";
      let artist = id3Tags?.artist || "Desconhecido";
      let genre = id3Tags?.genre || "";
      
      // Se não tem informações no ID3, extrair do nome do arquivo
      if (!title) {
        const fileName = path.basename(filePath, path.extname(filePath));
        title = fileName;
        
        // Tentar separar artista - título
        if (fileName.includes(" - ")) {
          const parts = fileName.split(" - ");
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        }
      }
      
      // Verificar e corrigir gênero no ID3
      let genreForDb = "geral"; // padrão
      let needsID3Update = false;
      
      if (typeof genre === "string") {
        // Verificar se o gênero é válido
        if (VALID_GENRES.includes(genre)) {
          // Gênero válido: converter para o banco
          genreForDb = GENRE_ID3_TO_DB[genre] || "geral";
        } else {
          // Gênero inválido ou vazio: preencher com "Sertanejo"
          console.log(`  → Gênero ID3 inválido ou vazio (${genre || "vazio"}), preenchendo com "Sertanejo"`);
          genre = "Sertanejo";
          genreForDb = "geral";
          needsID3Update = true;
        }
      } else {
        // Não é string: preencher com "Sertanejo"
        console.log(`  → Sem gênero ID3, preenchendo com "Sertanejo"`);
        genre = "Sertanejo";
        genreForDb = "geral";
        needsID3Update = true;
      }
      
      // Atualizar ID3 se necessário (apenas MP3)
      if (needsID3Update && filePath.toLowerCase().endsWith('.mp3')) {
        const tagsToUpdate: NodeID3.Tags = {
          title: title,
          artist: artist,
          genre: genre
        };
        
        if (updateID3Tags(filePath, tagsToUpdate)) {
          console.log(`  → Tags ID3 atualizadas com sucesso`);
          id3UpdatedCount++;
        } else {
          console.warn(`  → Falha ao atualizar tags ID3`);
        }
      }

      try {
        await db.insert(songs).values({
          title,
          artist,
          path: filePath,
          genre: genreForDb,
          timeSlots: 127, // Todos os horários por padrão (0b1111111)
          cover: "/images/logotipo.svg", // usar capa padrão quando não houver uma disponível
        });
        console.log(`  → Adicionada ao banco com gênero: ${genreForDb}`);
        addedCount++;
      } catch (error) {
        console.error(`Erro ao adicionar música ${filePath}:`, error);
      }
    }
  }

  console.log(`\nResumo da sincronização:`);
  console.log(`- Músicas removidas: ${removedCount}`);
  console.log(`- Músicas adicionadas: ${addedCount}`);
  console.log(`- Tags ID3 atualizadas: ${id3UpdatedCount}`);
  console.log("Sincronização concluída!");
}

syncDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro durante sincronização:", error);
    process.exit(1);
  });

