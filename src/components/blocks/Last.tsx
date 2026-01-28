"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { socket } from "@/lib/socket";

type LatestEntry = { id: number; title: string; artist: string; cover: string | null; playedAt?: number | null };

export default function HomeSectionsClient({ initialLatest }: { initialLatest: LatestEntry[] }) {
  const [latest, setLatest] = useState<LatestEntry[]>(initialLatest);

  useEffect(() => {
    const onSongChanged = (song: { id: number; title: string; artist: string; cover?: string | null }) => {
      const now = Date.now();
      const entry: LatestEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, playedAt: now };

      setLatest((prev) => {
        // avoid duplicates
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
    <div className="bg-background-alt border border-primary/20 rounded p-3">
      <h3 className="font-semibold mb-3">Últimas</h3>
      {latest.length === 0 ? (
        <div className="text-muted text-sm">Nenhuma música tocada ainda.</div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-10" />
              <col />
            </colgroup>
            <tbody>
              {latest.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2 pr-3 align-top">
                    <div className="w-9 h-9 relative rounded overflow-hidden">
                      <Image src={s.cover || "/images/logotipo.svg"} width={36} height={36} alt={s.title} className="rounded" />
                    </div>
                  </td>
                  <td className="py-2 min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-xs text-muted truncate">{s.artist}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
