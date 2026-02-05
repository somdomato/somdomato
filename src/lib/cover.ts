import { readdir, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as NodeID3 from "node-id3";

interface ID3Tags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  image?: {
    mime: string;
    type: {
      id: number;
      name: string;
    };
    description?: string;
    imageBuffer: Buffer;
  };
}

export interface ImageData {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface CoverResult {
  filePath: string;
  cover: string | null;
  error?: string;
}

/**
 * Normaliza nome de artista para busca inteligente
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[_\-.]+/g, " ") // Converte underscores, traços e pontos em espaço
    .replace(/\s*&\s*|\s*\+\s*|\s*\/\s*/g, " e ") // Mapeia &, +, / para " e "
    .replace(/\s+e\s+/g, " e ") // Normaliza espaçamento em torno de 'e'
    .replace(/\s+/g, " ") // Normaliza espaços
    .replace(/[^a-z0-9 ]/g, "") // Remove caracteres especiais remanescentes
    .trim();
}

/**
 * Gera nome de diretório canônico para o artista (ex: 'henrique_e_juliano')
 */
function artistDirName(name: string): string {
  return normalizeArtistName(name).replace(/\s+/g, "_");
}

/**
 * Busca capa pelo nome do artista, considerando variações comuns
 */
export async function findCoverByArtist(
  artist: string,
  coversDir: string = "public/covers",
): Promise<string | null> {
  const normalized = normalizeArtistName(artist);
  const dirs = await readdir(coversDir, { withFileTypes: true });
  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const candidate = normalizeArtistName(dirent.name);
    if (candidate === normalized) {
      // Retorna arquivo de capa preferencialmente nomeado 'cover.*' ou o primeiro existente
      const files = await readdir(path.join(coversDir, dirent.name));
      if (files.length > 0) {
        const coverFile =
          files.find((f) => /^cover\.[a-z0-9]+$/i.test(f)) ||
          files.find((f) => /^cover/i.test(f)) ||
          files[0];
        return path.join("/covers", dirent.name, coverFile).replace(/\\/g, "/");
      }
    }
  }
  return null;
}

/**
 * Extrai a capa de um arquivo MP3 e salva em disco organizando por artista
 * @param mp3FilePath - Caminho para o arquivo MP3
 * @param outputDir - Diretório base onde salvar as capas (padrão: public/covers)
 * @returns Promise<string | null> - Retorna o caminho da capa salva ou null se não houver capa
 */
export async function extractAndSaveCover(
  mp3FilePath: string,
  outputDir: string = "public/covers",
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    NodeID3.read(mp3FilePath, async (err: Error | null, tags: ID3Tags) => {
      if (err) {
        reject(err);
        return;
      }

      if (!tags?.image) {
        resolve(null);
        return;
      }

      try {
        // Obter informações do artista
        const artist = tags.artist || "Unknown Artist";
        const dirName = artistDirName(artist);

        // Criar diretório do artista
        const artistDir = path.join(outputDir, dirName);
        if (!existsSync(artistDir)) {
          await mkdir(artistDir, { recursive: true });
        }

        // Definir nome canônico da capa (cover.ext)
        const imageExtension = getImageExtension(tags.image.mime);
        const coverFileName = `cover${imageExtension}`;
        const coverPath = path.join(artistDir, coverFileName);

        // Salvar a imagem (sobrescreve se já existir)
        await writeFile(coverPath, tags.image.imageBuffer);

        // Remover arquivos extras dentro da pasta do artista, mantendo apenas a capa canônica
        const existingFiles = await readdir(artistDir);
        for (const f of existingFiles) {
          if (f !== coverFileName) {
            await unlink(path.join(artistDir, f));
          }
        }

        // Retornar o caminho relativo para uso no frontend (sempre com barras normais)
        const relativePath = coverPath
          .replace(/\\/g, "/") // Converter barras do Windows para web
          .replace("public/", "/"); // Remover "public" do início
        resolve(relativePath);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Extrai apenas os dados da capa sem salvar em disco
 * @param mp3FilePath - Caminho para o arquivo MP3
 * @returns Promise<ImageData | null> - Retorna os dados da imagem ou null
 */
export async function extractCoverData(
  mp3FilePath: string,
): Promise<ImageData | null> {
  return new Promise((resolve, reject) => {
    NodeID3.read(mp3FilePath, (err: Error | null, tags: ID3Tags) => {
      if (err) {
        reject(err);
        return;
      }

      if (!tags?.image) {
        resolve(null);
        return;
      }

      resolve({
        buffer: tags.image.imageBuffer,
        mimeType: tags.image.mime,
        extension: getImageExtension(tags.image.mime),
      });
    });
  });
}

/**
 * Extrai capas de múltiplos arquivos MP3 em lote
 * @param mp3FilePaths - Array de caminhos para arquivos MP3
 * @param outputDir - Diretório onde salvar as capas
 * @returns Promise<CoverResult[]> - Array com resultados
 */

export async function extractMultipleCovers(
  mp3FilePaths: string[],
  outputDir: string = "public/covers",
): Promise<CoverResult[]> {
  const results: CoverResult[] = [];

  for (const filePath of mp3FilePaths) {
    try {
      const cover = await extractAndSaveCover(filePath, outputDir);
      results.push({ filePath, cover });
    } catch (error) {
      results.push({
        filePath,
        cover: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Determina a extensão da imagem baseada no MIME type
 */
function getImageExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg"; // padrão
  }
}
