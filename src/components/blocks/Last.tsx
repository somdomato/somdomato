"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

type LatestEntry = {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  playedAt?: number | null;
};

export default function Last({ data }: { data: LatestEntry[] }) {
  const [latest, setLatest] = useState<LatestEntry[]>(data);
  const [, setTick] = useState(0);
  const { currentGenre } = useGenre();

  // Recarregar dados quando o gênero mudar
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/songs/last?genre=${currentGenre}`);
        if (res.ok) {
          const data = await res.json();
          setLatest(data);
        }
      } catch (err) {
        console.warn("Erro ao buscar últimas músicas:", err);
      }
    };

    fetchLatest();
  }, [currentGenre]);

  useEffect(() => {
    const onSongChanged = (song: {
      id: number;
      title: string;
      artist: string;
      cover?: string | null;
      genre?: string;
      allowedInGeneral?: number;
      playedAt?: number;
    }) => {
      // Filtrar por gênero:
      // - Se estou em "geral": aceitar músicas com genre='geral' OU allowedInGeneral=1
      // - Se estou em outro gênero: aceitar apenas músicas daquele gênero
      let shouldInclude = false;
      
      if (currentGenre === "geral") {
        shouldInclude = song.genre === "geral" || song.allowedInGeneral === 1;
      } else {
        shouldInclude = song.genre === currentGenre;
      }

      if (!shouldInclude) {
        return;
      }

      const entry: LatestEntry = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        cover: song.cover || null,
        playedAt: song.playedAt || Date.now(),
      };

      setLatest((prev) => {
        const filtered = prev.filter((p) => p.id !== entry.id);
        return [entry, ...filtered].slice(0, 10);
      });
    };

    socket.on("song:changed", onSongChanged);
    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, [currentGenre]);

  // Atualizar tempos relativos a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SongBlock icon={CircleArrowLeft} title="Últimas">
      {latest.length === 0 ? (
        <div className="text-muted text-sm">
          Nenhuma música tocada ainda neste gênero.
        </div>
      ) : (
        <SongList
          items={latest}
          renderRight={(item) =>
            formatRelativeTime((item as LatestEntry).playedAt)
          }
        />
      )}
    </SongBlock>
  );
}
