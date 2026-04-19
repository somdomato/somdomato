import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RADIO_CONFIG, GENRES, DEFAULT_SONG, isValidGenre } from "@/config";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getLiveState, setLive } from "@/lib/live";

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

    // Auto-detectar modo ao vivo pelo título do mountpoint geral
    // Verificar TANTO o título quanto a ausência de artista separado:
    // AutoDJ sempre envia title+artist via annotate do Liquidsoap,
    // enquanto DJs ao vivo (BUTT) normalmente só definem o título.
    // Isso evita falso positivo com músicas cujo título contém "Ao Vivo".
    const geralSource = sources.find((s) => s.listenurl?.endsWith("/geral"));
    if (geralSource) {
      const rawGeralTitle = geralSource.title || "";
      const geralArtist = geralSource.artist || "";
      const isLiveBroadcast =
        /ao\s*vivo/i.test(rawGeralTitle) && !geralArtist;
      const currentLiveState = getLiveState();
      if (isLiveBroadcast && !currentLiveState.live) {
        setLive(true);
        global.io?.emit("live:changed", getLiveState());
      } else if (!isLiveBroadcast && currentLiveState.live) {
        setLive(false);
        global.io?.emit("live:changed", getLiveState());
      }
    }

    // Extrair título e artista
    let title: string = DEFAULT_SONG.title;
    let artist: string = DEFAULT_SONG.artist;

    // Limpar "AOVIVO" / "AO VIVO" do título para exibição
    let rawTitle = source.title || "";
    if (/ao\s*vivo/i.test(rawTitle)) {
      rawTitle = rawTitle
        .replace(/ao\s*vivo/gi, "")
        .replace(/^\s*[-–—]\s*/, "")
        .replace(/\s*[-–—]\s*$/, "")
        .trim();
    }

    if (rawTitle) {
      // Se tiver artista separado
      if (source.artist) {
        title = rawTitle;
        artist = source.artist;
      } else {
        // Tentar separar "Artista - Título"
        const parts = rawTitle.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        } else {
          title = rawTitle;
        }
      }
    }

    // Buscar cover e id do banco de dados pelo título e artista
    let cover: string = DEFAULT_SONG.cover;
    let id: number | undefined;
    if (title !== DEFAULT_SONG.title && artist !== DEFAULT_SONG.artist) {
      try {
        const [match] = await db
          .select({ id: songs.id, cover: songs.cover })
          .from(songs)
          .where(and(eq(songs.title, title), eq(songs.artist, artist)))
          .limit(1);
        if (match) {
          id = match.id;
          if (match.cover && match.cover !== "/images/logotipo.svg") {
            cover = match.cover;
          }
        }
      } catch {
        // fallback para cover padrão
      }
    }

    return NextResponse.json({
      song: {
        id,
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
