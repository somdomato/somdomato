"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

type LatestEntry = { id: number; title: string; artist: string; cover: string | null; playedAt?: number | null };

export default function Last({ data }: { data: LatestEntry[] }) {
  const [latest, setLatest] = useState<LatestEntry[]>(data);
  const [, setTick] = useState(0);
  const { currentGenre } = useGenre();

  useEffect(() => {
    const onSongChanged = (song: { id: number; title: string; artist: string; cover?: string | null }) => {
      const now = Date.now();
      const entry: LatestEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, playedAt: now };

      setLatest((prev) => {
        const filtered = prev.filter((p) => p.id !== entry.id);
        return [entry, ...filtered].slice(0, 10);
      });
    };

    socket.on("song:changed", onSongChanged);
    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  // Atualizar tempos relativos a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Mostrar apenas se estiver no gênero "geral"
  if (currentGenre !== "geral") {
    return (
      <SongBlock icon={CircleArrowLeft} title="Últimas">
        <div className="text-muted text-sm">Histórico disponível apenas no gênero Geral.</div>
      </SongBlock>
    );
  }

  return (
    <SongBlock icon={CircleArrowLeft} title="Últimas">
      {latest.length === 0 ? <div className="text-muted text-sm">Nenhuma música tocada ainda.</div> : <SongList items={latest} renderRight={(item) => formatRelativeTime((item as LatestEntry).playedAt)} />}
    </SongBlock>
  );
}
