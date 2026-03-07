import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RADIO_CONFIG, GENRES, DEFAULT_SONG, isValidGenre } from "@/config";

interface IcecastSource {
  listenurl: string;
  server_name?: string;
  server_description?: string;
  server_type?: string;
  stream_start?: string;
  listeners?: number;
  title?: string;
  artist?: string;
}

interface IcecastMetadata {
  icestats: {
    source?: IcecastSource | IcecastSource[];
  };
}

/**
 * API para buscar metadados da stream por gênero
 * GET /api/metadata?genre=geral
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const genre = searchParams.get("genre") || "geral";

    // Validar gênero
    if (!isValidGenre(genre)) {
      return NextResponse.json(
        { error: "Gênero inválido", song: DEFAULT_SONG },
        { status: 400 },
      );
    }

    // Buscar informações do mountpoint correspondente
    const genreInfo = GENRES.find((g) => g.value === genre);
    if (!genreInfo) {
      return NextResponse.json(
        { error: "Gênero não encontrado", song: DEFAULT_SONG },
        { status: 404 },
      );
    }

    // Fazer request para o JSON do Icecast
    const metadataUrl = RADIO_CONFIG.metadataUrl;
    const response = await fetch(metadataUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "SomDoMato/1.0",
      },
    });

    if (!response.ok) {
      console.error("Falha ao buscar metadados do Icecast:", response.status);
      return NextResponse.json({ song: DEFAULT_SONG });
    }

    const data: IcecastMetadata = await response.json();

    // Garantir que source seja array
    let sources: IcecastSource[] = [];
    if (data.icestats.source) {
      sources = Array.isArray(data.icestats.source)
        ? data.icestats.source
        : [data.icestats.source];
    }

    // Encontrar a source correspondente ao mountpoint
    const targetMountpoint = `/${genreInfo.mountpoint}`;
    const source = sources.find((s) => s.listenurl?.endsWith(targetMountpoint));

    if (!source) {
      console.warn(`Mountpoint ${targetMountpoint} não encontrado no Icecast`);
      return NextResponse.json({ song: DEFAULT_SONG });
    }

    // Extrair título e artista
    let title: string = DEFAULT_SONG.title;
    let artist: string = DEFAULT_SONG.artist;
    const cover: string = DEFAULT_SONG.cover;

    if (source.title) {
      // Se tiver artista separado
      if (source.artist) {
        title = source.title;
        artist = source.artist;
      } else {
        // Tentar separar "Artista - Título"
        const parts = source.title.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        } else {
          title = source.title;
        }
      }
    }

    // TODO: Buscar cover do banco de dados se necessário
    // Por enquanto usa cover padrão

    return NextResponse.json({
      song: {
        title,
        artist,
        cover,
      },
      listeners: source.listeners || 0,
      genre: genreInfo.label,
    });
  } catch (error) {
    // Icecast pode estar offline (ECONNREFUSED, etc.) — retorna fallback silenciosamente
    const isNetworkError =
      error instanceof TypeError && error.message.includes("fetch failed");
    if (!isNetworkError) {
      console.error("Erro ao buscar metadados:", error);
    }
    return NextResponse.json({ song: DEFAULT_SONG });
  }
}
