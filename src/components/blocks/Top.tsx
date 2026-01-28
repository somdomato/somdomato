"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { socket } from "@/lib/socket";

type TopEntry = { id: number; title: string; artist: string; cover: string | null; count: number };

export default function HomeSectionsClient({ initialTop }: { initialTop: TopEntry[] }) {
  const [top, setTop] = useState<TopEntry[]>(initialTop);

  useEffect(() => {
    const onSongChanged = (song: { id: number; title: string; artist: string; cover?: string | null }) => {
      setTop((prev) => {
        const found = prev.find((p) => p.id === song.id);
        if (found) {
          return prev
            .map((p) => (p.id === song.id ? { ...p, count: p.count + 1 } : p))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
        // if not found, add with count=1, then sort by count and keep top 10
        const added: TopEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, count: 1 };
        return [added, ...prev].sort((a, b) => b.count - a.count).slice(0, 10);
      });
    };

    socket.on("song:changed", onSongChanged);

    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <div className="bg-background-alt border border-primary/20 rounded p-3">
      <h3 className="font-semibold mb-3">TOP 10</h3>
      {top.length === 0 ? (
        <div className="text-muted text-sm">Sem dados de reprodução.</div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-10" />
              <col />
              <col className="w-14" />
            </colgroup>
            <tbody>
              {top.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2 pr-3 align-top">
                    <div className="w-9 h-9 relative rounded overflow-hidden">
                      <Image src={t.cover || "/images/logotipo.svg"} width={36} height={36} alt={t.title} className="rounded" />
                    </div>
                  </td>
                  <td className="py-2 min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted truncate">{t.artist}</div>
                  </td>
                  <td className="py-2 text-right text-xs text-muted pl-3">{t.count}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
