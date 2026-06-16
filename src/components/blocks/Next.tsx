"use client";

import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import { useLive } from "@/context/LiveContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { isJingleMetadata } from "@/lib/song-visibility";

type UpcomingEntry = {
  reqId: number;
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  requestedAt?: number | null;
  source: "request" | "autodj";
};

export default function Next({ data }: { data: UpcomingEntry[] }) {
  const [items, setItems] = useState<UpcomingEntry[]>(data);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const { currentGenre } = useGenre();

  useEffect(() => setMounted(true), []);
  const { live, djName } = useLive();

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/next?genre=${currentGenre}`);
      if (!res.ok) return;
      const json = await res.json();
      const upcoming: UpcomingEntry[] = (json.upcoming || []).filter(
        (u: UpcomingEntry) =>
          !isJingleMetadata({ title: u.title, artist: u.artist }),
      );
      setItems(upcoming);
    } catch (err) {
      console.warn("fetchUpcoming failed:", err);
    }
  }, [currentGenre]);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  useEffect(() => {
    socket.on("song:changed", fetchUpcoming);
    socket.on("request:removed", fetchUpcoming);
    socket.on("request:added", fetchUpcoming);
    socket.on("requests:updated", fetchUpcoming);

    return () => {
      socket.off("song:changed", fetchUpcoming);
      socket.off("request:removed", fetchUpcoming);
      socket.off("request:added", fetchUpcoming);
      socket.off("requests:updated", fetchUpcoming);
    };
  }, [fetchUpcoming]);

  // Atualizar tempos relativos a cada minuto
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const hasRequests = items.some((i) => i.source === "request");

  return (
    <SongBlock icon={CircleArrowRight} title="Próximas">
      {live ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            AO VIVO
          </span>
          <p className="text-sm text-muted">
            {djName ? (
              <>
                <strong className="text-white">{djName}</strong> está no comando
                da locução ao vivo.
              </>
            ) : (
              "Um DJ está no comando da locução ao vivo."
            )}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted text-sm">Calculando próxima música...</div>
      ) : (
        <SongList
          items={items}
          keyField="reqId"
          rightColClass={hasRequests ? "w-36" : "w-24"}
          renderRight={(item) => {
            const entry = item as UpcomingEntry;

            if (entry.source === "autodj") {
              return (
                <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                  AutoDJ
                </span>
              );
            }

            return (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted whitespace-nowrap">
                  {mounted ? formatRelativeTime(entry.requestedAt) : ""}
                </span>
                <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded whitespace-nowrap">
                  Pedido
                </span>
              </div>
            );
          }}
        />
      )}
    </SongBlock>
  );
}
