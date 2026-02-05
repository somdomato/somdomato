"use client";

import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { Trophy } from "lucide-react";

type TopEntry = {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  count: number;
};

export default function Top({ data }: { data: TopEntry[] }) {
  const [top, setTop] = useState<TopEntry[]>(data);

  useEffect(() => {
    const onSongChanged = (song: {
      id: number;
      title: string;
      artist: string;
      cover?: string | null;
    }) => {
      setTop((prev) => {
        const found = prev.find((p) => p.id === song.id);
        if (found) {
          return prev
            .map((p) => (p.id === song.id ? { ...p, count: p.count + 1 } : p))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
        const added: TopEntry = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          cover: song.cover || null,
          count: 1,
        };
        return [added, ...prev].sort((a, b) => b.count - a.count).slice(0, 10);
      });
    };

    socket.on("song:changed", onSongChanged);
    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <SongBlock icon={Trophy} title="TOP 10">
      {top.length === 0 ? (
        <div className="text-muted text-sm">Sem dados de reprodução.</div>
      ) : (
        <SongList items={top} renderRight={(t) => `${t.count}x`} />
      )}
    </SongBlock>
  );
}
