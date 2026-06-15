"use client";

import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { Trophy } from "lucide-react";
import { isJingleMetadata } from "@/lib/song-visibility";

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
    const onRequestAdded = (req: {
      id: number;
      title: string;
      artist: string;
      cover?: string | null;
    }) => {
      if (isJingleMetadata({ title: req.title, artist: req.artist })) {
        return;
      }

      setTop((prev) => {
        const found = prev.find((p) => p.id === req.id);
        if (found) {
          return prev
            .map((p) => (p.id === req.id ? { ...p, count: p.count + 1 } : p))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
        const added: TopEntry = {
          id: req.id,
          title: req.title,
          artist: req.artist,
          cover: req.cover || null,
          count: 1,
        };
        return [added, ...prev].sort((a, b) => b.count - a.count).slice(0, 10);
      });
    };

    socket.on("request:added", onRequestAdded);
    return () => {
      socket.off("request:added", onRequestAdded);
    };
  }, []);

  return (
    <SongBlock icon={Trophy} title="TOP 10">
      {top.length === 0 ? (
        <div className="text-muted text-sm">Nenhum pedido ainda.</div>
      ) : (
        <SongList items={top} numbered renderRight={(t) => `${t.count}x`} />
      )}
    </SongBlock>
  );
}
