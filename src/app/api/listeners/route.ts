import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RADIO_CONFIG, GENRES } from "@/config";

interface IcecastSource {
  listenurl: string;
  server_name?: string;
  server_description?: string;
  server_type?: string;
  stream_start?: string;
  listeners?: number;
  listener_peak?: number;
  title?: string;
  artist?: string;
}

interface IcecastMetadata {
  icestats: {
    source?: IcecastSource | IcecastSource[];
  };
}

export type MountpointListeners = {
  mountpoint: string;
  label: string;
  listeners: number;
  peak: number;
};

export type ListenersResponse = {
  mountpoints: MountpointListeners[];
  total: number;
  totalPeak: number;
};

/**
 * GET /api/listeners
 * Retorna contagem de ouvintes para todos os mountpoints
 */
export async function GET(_request: NextRequest) {
  try {
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
      return NextResponse.json<ListenersResponse>({
        mountpoints: [],
        total: 0,
        totalPeak: 0,
      });
    }

    const data: IcecastMetadata = await response.json();

    // Garantir que source seja array
    let sources: IcecastSource[] = [];
    if (data.icestats.source) {
      sources = Array.isArray(data.icestats.source)
        ? data.icestats.source
        : [data.icestats.source];
    }

    // Mapear ouvintes por mountpoint
    const mountpoints: MountpointListeners[] = [];
    let total = 0;
    let totalPeak = 0;

    for (const genre of GENRES) {
      const targetMountpoint = `/${genre.mountpoint}`;
      const source = sources.find((s) =>
        s.listenurl?.endsWith(targetMountpoint),
      );

      const listeners = source?.listeners || 0;
      const peak = source?.listener_peak || 0;

      mountpoints.push({
        mountpoint: genre.mountpoint,
        label: genre.label,
        listeners,
        peak,
      });

      total += listeners;
      totalPeak += peak;
    }

    return NextResponse.json<ListenersResponse>({
      mountpoints,
      total,
      totalPeak,
    });
  } catch (error) {
    // Icecast pode estar offline (ECONNREFUSED, etc.) — retorna fallback silenciosamente
    const isNetworkError =
      error instanceof TypeError && error.message.includes("fetch failed");
    if (!isNetworkError) {
      console.error("Erro ao buscar ouvintes:", error);
    }
    return NextResponse.json<ListenersResponse>({
      mountpoints: [],
      total: 0,
      totalPeak: 0,
    });
  }
}
