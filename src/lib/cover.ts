import { writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as NodeID3 from "node-id3";

// ---------------------------------------------------------------------------
// Helpers de nome
// ---------------------------------------------------------------------------

/**
 * Converte nome de artista em slug seguro para usar como nome de arquivo.
 * Ex: "Henrique & Juliano" → "henrique-e-juliano"
 *     "Jorge e Mateus"     → "jorge-e-mateus"
 */
export function sanitizeArtistForFile(artist: string): string {
  return artist
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s*[&+/]\s*/g, "-e-") // & + / → -e-
    .replace(/\s+e\s+/g, "-e-") // "e" como palavra → -e-
    .replace(/[^a-z0-9-]/g, "-") // tudo mais → -
    .replace(/-+/g, "-") // colapsar traços duplos
    .replace(/^-|-$/g, ""); // remover traços nas bordas
}

/** Caminho físico do arquivo de capa para um artista */
export function coverPublicPath(
  artist: string,
  coversDir = path.join(process.cwd(), "public/covers"),
): string {
  return path.join(coversDir, `${sanitizeArtistForFile(artist)}.jpg`);
}

/** Caminho da URL pública da capa */
export function coverUrlPath(artist: string): string {
  return `/covers/${sanitizeArtistForFile(artist)}.jpg`;
}

// ---------------------------------------------------------------------------
// Verificar capa existente no disco
// ---------------------------------------------------------------------------

/**
 * Verifica se já existe um arquivo de capa válido (>= 1 KB) para o artista.
 * Retorna o URL path se existir, null caso contrário.
 */
export async function checkExistingCover(
  artist: string,
  coversDir = path.join(process.cwd(), "public/covers"),
): Promise<string | null> {
  const filePath = coverPublicPath(artist, coversDir);
  if (!existsSync(filePath)) return null;
  try {
    const info = await stat(filePath);
    if (info.size < 1000) return null; // arquivo muito pequeno → inválido
    return coverUrlPath(artist);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extração do ID3
// ---------------------------------------------------------------------------

/**
 * Extrai a imagem embutida nas tags ID3 do arquivo MP3 e salva em disco
 * como `public/covers/[slug].jpg`.
 *
 * @param mp3FilePath  Caminho absoluto do arquivo MP3
 * @param artist       Nome do artista (para determinar o slug do arquivo)
 * @param coversDir    Diretório raiz de capas (padrão: public/covers)
 * @returns URL path da capa salva, ou null se não houver imagem ID3
 */
export async function extractAndSaveCover(
  mp3FilePath: string,
  artist: string,
  coversDir = path.join(process.cwd(), "public/covers"),
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    NodeID3.read(mp3FilePath, async (err: Error | null, tags: NodeID3.Tags) => {
      if (err) {
        reject(err);
        return;
      }
      if (!tags?.image) {
        resolve(null);
        return;
      }

      try {
        await mkdir(coversDir, { recursive: true });

        const image = tags.image as {
          imageBuffer: Buffer;
          mime?: string;
        };

        // Validar buffer básico antes de salvar
        if (!image.imageBuffer || image.imageBuffer.length < 1000) {
          resolve(null);
          return;
        }

        const filePath = coverPublicPath(artist, coversDir);
        await writeFile(filePath, image.imageBuffer);

        resolve(coverUrlPath(artist));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Busca via API (Deezer) — usado apenas na auto-resolução no play
// ---------------------------------------------------------------------------

/**
 * Busca a capa de um artista/título via API do Deezer.
 * Retorna o buffer da imagem, ou null em caso de erro ou não encontrado.
 *
 * Limites: Deezer permite ~50 req/s. Como usamos somente quando a capa
 * não existe no disco e somente no evento de play (1 req por música nova),
 * o volume de chamadas é baixíssimo.
 */
export async function fetchCoverFromDeezer(
  artist: string,
  title: string,
): Promise<Buffer | null> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const searchUrl = `https://api.deezer.com/search?q=${query}&limit=1`;

    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "SomDoMato-Radio/1.0" },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const track = searchData?.data?.[0];

    // Preferir cover_xl (1000x1000), fallback para cover_medium (250x250)
    const coverUrl: string | undefined =
      track?.album?.cover_xl || track?.album?.cover_medium;

    if (!coverUrl) return null;

    const imgRes = await fetch(coverUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!imgRes.ok) return null;

    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // Validação de integridade: tamanho mínimo + magic bytes de imagem
    if (buffer.length < 1000) return null;
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
    if (!isJpeg && !isPng) return null;

    return buffer;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pipeline principal de resolução (usado no play automático)
// ---------------------------------------------------------------------------

/**
 * Resolve a capa de uma música seguindo a ordem de prioridade:
 *  1. Arquivo já existe no disco (`public/covers/[slug].jpg`) → reutiliza
 *  2. Extração das tags ID3 do arquivo MP3
 *  3. Busca via API do Deezer
 *
 * Retorna o URL path (ex: `/covers/henrique-e-juliano.jpg`) ou null.
 *
 * IMPORTANTE: Esta função NÃO deve ser chamada se a música já tem uma capa
 * diferente do padrão (`/images/logotipo.svg`) — isso protege capas
 * configuradas manualmente no painel de admin.
 */
export async function resolveSongCover(opts: {
  mp3Path: string;
  artist: string;
  title: string;
  coversDir?: string;
}): Promise<string | null> {
  const {
    mp3Path,
    artist,
    title,
    coversDir = path.join(process.cwd(), "public/covers"),
  } = opts;

  // 1. Arquivo de capa já existe no disco?
  const existing = await checkExistingCover(artist, coversDir);
  if (existing) {
    return existing;
  }

  // 2. Extração das tags ID3
  try {
    const fromId3 = await extractAndSaveCover(mp3Path, artist, coversDir);
    if (fromId3) {
      return fromId3;
    }
  } catch (e) {
    console.warn(`[cover] Falha na extração ID3 de ${mp3Path}:`, e);
  }

  // 3. API do Deezer (somente se arquivo não existe e ID3 não tem capa)
  try {
    const buffer = await fetchCoverFromDeezer(artist, title);
    if (buffer) {
      await mkdir(coversDir, { recursive: true });
      const filePath = coverPublicPath(artist, coversDir);
      await writeFile(filePath, buffer);
      return coverUrlPath(artist);
    }
  } catch (e) {
    console.warn(`[cover] Falha no Deezer para "${artist} - ${title}":`, e);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Remoção de capa (usada pelo admin ao resetar)
// ---------------------------------------------------------------------------

/**
 * Remove o arquivo de capa do disco para um artista.
 * Chamado quando admin "Apaga capa" para garantir que a auto-resolução
 * possa buscar uma nova imagem na próxima execução.
 */
export async function deleteArtistCover(
  artist: string,
  coversDir = path.join(process.cwd(), "public/covers"),
): Promise<void> {
  const filePath = coverPublicPath(artist, coversDir);
  if (!existsSync(filePath)) return;
  try {
    await unlink(filePath);
  } catch (e) {
    console.warn(`[cover] Não foi possível remover ${filePath}:`, e);
  }
}
