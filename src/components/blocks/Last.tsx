"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

type LatestEntry = {
  historyId?: number;
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
      playedOnMountpoint?: string;
    }) => {
      // Filtrar pelo mountpoint onde a música foi TOCADA
      // playedOnMountpoint indica em qual mountpoint a música foi tocada
      const mountpoint = song.playedOnMountpoint || song.genre || "geral";

      if (mountpoint !== currentGenre) {
        return;
      }

      const now = Date.now();
      const entry: LatestEntry = {
        historyId: now,
        id: song.id,
        title: song.title,
        artist: song.artist,
        cover: song.cover || null,
        playedAt: song.playedAt || now,
      };

      setLatest((prev) => [entry, ...prev].slice(0, 10));
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
          keyField="historyId"
          renderRight={(item) =>
            formatRelativeTime((item as LatestEntry).playedAt)
          }
        />
      )}
    </SongBlock>
  );
}
