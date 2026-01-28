"use client";

import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socket";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowRight } from "lucide-react";

type UpcomingEntry = { reqId: number; id: number; title: string; artist: string; cover: string | null; requestedAt?: number | null };

export default function Next({ data, initialNextIfNoRequests }: { data: UpcomingEntry[]; initialNextIfNoRequests: UpcomingEntry | null }) {
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>(data);
  const [nextIfNoRequests] = useState<UpcomingEntry | null>(initialNextIfNoRequests);

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) return;
      const json = await res.json();
      setUpcoming(json.upcoming || []);
    } catch (err) {
      console.warn("fetchUpcoming failed:", err);
    }
  }, []);

  useEffect(() => {
    const onRequestRemoved = (req: { requestId?: number; id?: number; reqId?: number }) => {
      const reqId = req?.requestId ?? req?.id ?? req?.reqId;
      if (reqId == null) {
        fetchUpcoming();
        return;
      }
      setUpcoming((prev) => prev.filter((u) => u.reqId !== reqId));
    };

    const onRequestAdded = (req: unknown) => {
      if (req && typeof req === "object" && "reqId" in req) {
        const r = req as UpcomingEntry;
        setUpcoming((prev) => {
          if (prev.some((p) => p.reqId === r.reqId)) return prev;
          return [...prev, { ...r, cover: r.cover ?? null }].slice(-10);
        });
        return;
      }
      fetchUpcoming();
    };

    socket.on("song:changed", fetchUpcoming);
    socket.on("request:removed", onRequestRemoved);
    socket.on("request:added", onRequestAdded);
    socket.on("requests:updated", fetchUpcoming);

    return () => {
      socket.off("song:changed", fetchUpcoming);
      socket.off("request:removed", onRequestRemoved);
      socket.off("request:added", onRequestAdded);
      socket.off("requests:updated", fetchUpcoming);
    };
  }, [fetchUpcoming]);

  return (
    <SongBlock icon={CircleArrowRight} title="Próximas">
      {upcoming.length === 0 ? (
        nextIfNoRequests ? (
          <SongList items={[{ id: nextIfNoRequests.reqId ?? "auto", title: nextIfNoRequests.title, artist: nextIfNoRequests.artist, cover: nextIfNoRequests.cover }]} />
        ) : (
          <div className="text-muted text-sm">Sem pedidos pendentes.</div>
        )
      ) : (
        <SongList items={upcoming} keyField="reqId" />
      )}
    </SongBlock>
  );
}
