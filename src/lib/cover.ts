import { writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import NodeID3 from "node-id3";

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

/**
 * Verifica se um URL de capa (ex: `/covers/artista.jpg`) corresponde a um
 * arquivo válido no disco (>= 1 KB). Útil para validar antes de salvar no banco.
 *
 * Retorna o próprio `coverUrl` se válido, ou `null` caso contrário.
 */
export async function verifyCoverOnDisk(
  coverUrl: string,
  publicDir = path.join(process.cwd(), "public"),
): Promise<string | null> {
  if (!coverUrl || coverUrl === "/images/logotipo.svg") return null;
  const filePath = path.join(publicDir, coverUrl.replace(/^\/+/, ""));
  if (!existsSync(filePath)) return null;
  try {
    const info = await stat(filePath);
    if (info.size < 1000) return null;
    return coverUrl;
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

        // Validar buffer: tamanho mínimo + magic bytes de imagem
        if (!image.imageBuffer || image.imageBuffer.length < 1000) {
          resolve(null);
          return;
        }
        const buf = image.imageBuffer;
        const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
        const isPng = buf[0] === 0x89 && buf[1] === 0x50;
        if (!isJpeg && !isPng) {
          resolve(null);
          return;
        }

        const filePath = coverPublicPath(artist, coversDir);
        await writeFile(filePath, image.imageBuffer);

        // Verificar se o arquivo realmente persistiu no disco
        const url = coverUrlPath(artist);
        const verified = await verifyCoverOnDisk(url, path.dirname(coversDir));
        resolve(verified);
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
// Helper: validar e salvar buffer de imagem como capa
// ---------------------------------------------------------------------------

/**
 * Valida um buffer de imagem (>= 1 KB, magic bytes JPEG/PNG) e salva em disco.
 * Retorna o URL path verificado, ou `null` se inválido.
 */
async function saveImageBufferAsCover(
  buffer: Buffer,
  artist: string,
  coversDir: string,
): Promise<string | null> {
  if (buffer.length < 1000) return null;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  if (!isJpeg && !isPng) return null;

  await mkdir(coversDir, { recursive: true });
  const filePath = coverPublicPath(artist, coversDir);
  await writeFile(filePath, buffer);

  const url = coverUrlPath(artist);
  return verifyCoverOnDisk(url, path.dirname(coversDir));
}

// ---------------------------------------------------------------------------
// Busca via URL direta — fallback quando todas as outras fontes falham
// ---------------------------------------------------------------------------

/**
 * Baixa uma imagem de uma URL direta (ex: thumbnail do Deezer salvo no upload).
 * Valida integridade (>= 1 KB, magic bytes) e salva em disco.
 */
async function fetchCoverFromUrl(
  url: string,
  artist: string,
  coversDir: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return saveImageBufferAsCover(buffer, artist, coversDir);
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
 *  4. Download da `fallbackUrl` (ex: thumbnail do Deezer salvo no upload)
 *
 * Retorna o URL path (ex: `/covers/henrique-e-juliano.jpg`) ou null.
 */
export async function resolveSongCover(opts: {
  mp3Path: string;
  artist: string;
  title: string;
  coversDir?: string;
  fallbackUrl?: string;
}): Promise<string | null> {
  const {
    mp3Path,
    artist,
    title,
    coversDir = path.join(process.cwd(), "public/covers"),
    fallbackUrl,
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
      const verified = await saveImageBufferAsCover(buffer, artist, coversDir);
      if (verified) return verified;
    }
  } catch (e) {
    console.warn(`[cover] Falha no Deezer para "${artist} - ${title}":`, e);
  }

  // 4. Fallback URL direto (ex: thumbnail do Deezer salvo na tabela uploads)
  if (fallbackUrl) {
    try {
      const fromUrl = await fetchCoverFromUrl(fallbackUrl, artist, coversDir);
      if (fromUrl) return fromUrl;
    } catch (e) {
      console.warn(`[cover] Falha no fallback URL ${fallbackUrl}:`, e);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Validação para escrita no banco de dados
// ---------------------------------------------------------------------------

/**
 * Gate de validação central: toda escrita de `cover` no banco DEVE passar
 * por esta função. Garante que nunca salvamos uma capa quebrada/inexistente.
 *
 * @returns O URL verificado se o arquivo existe no disco e é >= 1 KB, ou `null`.
 */
export async function validateCoverForDb(
  coverUrl: string | null | undefined,
): Promise<string | null> {
  if (!coverUrl || coverUrl === "/images/logotipo.svg") return null;
  return verifyCoverOnDisk(coverUrl);
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
