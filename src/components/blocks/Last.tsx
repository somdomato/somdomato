"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowLeft } from "lucide-react";

type LatestEntry = { id: number; title: string; artist: string; cover: string | null; playedAt?: number | null };

export default function Last({ data }: { data: LatestEntry[] }) {
  const [latest, setLatest] = useState<LatestEntry[]>(data);

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

  return (
    <SongBlock icon={CircleArrowLeft} title="Últimas">
      {latest.length === 0 ? <div className="text-muted text-sm">Nenhuma música tocada ainda.</div> : <SongList items={latest} />}
    </SongBlock>
  );
}
