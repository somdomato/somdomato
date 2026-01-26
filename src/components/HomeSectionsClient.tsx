"use client";

import React from "react";
import Image from "next/image";
import { socket } from "@/lib/socket";

type TopEntry = { id: number; title: string; artist: string; cover: string | null; count: number };
type LatestEntry = { id: number; title: string; artist: string; cover: string | null; playedAt?: number | null };
type UpcomingEntry = { reqId: number; id: number; title: string; artist: string; cover: string | null; requestedAt?: number | null };

export default function HomeSectionsClient({
  initialLatest,
  initialTop,
  initialUpcoming,
  initialNextIfNoRequests,
}: {
  initialLatest: LatestEntry[];
  initialTop: TopEntry[];
  initialUpcoming: UpcomingEntry[];
  initialNextIfNoRequests: UpcomingEntry | null;
}) {
  const [latest, setLatest] = React.useState<LatestEntry[]>(initialLatest);
  const [top, setTop] = React.useState<TopEntry[]>(initialTop);
  const [upcoming, setUpcoming] = React.useState<UpcomingEntry[]>(initialUpcoming);
  const [nextIfNoRequests] = React.useState<UpcomingEntry | null>(initialNextIfNoRequests);

  // Helper to fetch upcoming from public API endpoint
  const fetchUpcoming = React.useCallback(async () => {
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) return;
      const data = await res.json();
      setUpcoming(data.upcoming || []);
    } catch (err) {
      console.warn("fetchUpcoming failed:", err);
    }
  }, []);

  React.useEffect(() => {
    const onSongChanged = (song: { id: number; title: string; artist: string; cover?: string | null }) => {
      const now = Date.now();
      const entry: LatestEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, playedAt: now };

      setLatest((prev) => {
        // avoid duplicates
        const filtered = prev.filter((p) => p.id !== entry.id);
        return [entry, ...filtered].slice(0, 10);
      });

      setTop((prev) => {
        const found = prev.find((p) => p.id === song.id);
        if (found) {
          return prev.map((p) => (p.id === song.id ? { ...p, count: p.count + 1 } : p)).sort((a, b) => b.count - a.count).slice(0, 10);
        }
        // if not found, add with count=1 and keep top 10
        const added: TopEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, count: 1 };
        return [added, ...prev].slice(0, 10);
      });

      // When a song changed, it's often because a request was consumed — refresh upcoming
      // to keep UI consistent
      fetchUpcoming();
    };

    const onRequestRemoved = (req: { requestId?: number; id?: number; reqId?: number }) => {
      // req likely contains requestId as requestId
      const reqId = req?.requestId ?? req?.id ?? req?.reqId;
      if (reqId == null) {
        // fallback: refetch
        fetchUpcoming();
        return;
      }
      setUpcoming((prev) => prev.filter((u) => u.reqId !== reqId));
    };

    const onRequestAdded = (_req: unknown) => {
      // If server emits this, refresh upcoming
      fetchUpcoming();
    };

    socket.on("song:changed", onSongChanged);
    socket.on("request:removed", onRequestRemoved);
    socket.on("request:added", onRequestAdded);

    return () => {
      socket.off("song:changed", onSongChanged);
      socket.off("request:removed", onRequestRemoved);
      socket.off("request:added", onRequestAdded);
    };
  }, [fetchUpcoming]);

  return (
    <section className="mt-6 max-w-4xl mx-auto w-full px-2 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">Últimas</h3>
          <ul className="space-y-2 text-sm">
            {latest.length === 0 ? (
              <li className="text-muted">Nenhuma música tocada ainda.</li>
            ) : (
              latest.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Image src={s.cover || "/images/logotipo.svg"} width={36} height={36} alt={s.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted">{s.artist}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">TOP 10</h3>
          <ul className="space-y-2 text-sm">
            {top.length === 0 ? (
              <li className="text-muted">Sem dados de reprodução.</li>
            ) : (
              top.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <Image src={t.cover || "/images/logotipo.svg"} width={36} height={36} alt={t.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted">
                      {t.artist} • {t.count}x
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">Próximas</h3>
          <ul className="space-y-2 text-sm">
            {upcoming.length === 0 ? (
              nextIfNoRequests ? (
                <li className="flex items-center gap-3">
                  <Image src={nextIfNoRequests.cover || "/images/logotipo.svg"} width={36} height={36} alt={nextIfNoRequests.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{nextIfNoRequests.title}</div>
                    <div className="text-xs text-muted">{nextIfNoRequests.artist} • selecionada pelo AutoDJ</div>
                  </div>
                </li>
              ) : (
                <li className="text-muted">Sem pedidos pendentes.</li>
              )
            ) : (
              upcoming.map((u) => (
                <li key={u.reqId} className="flex items-center gap-3">
                  <Image src={u.cover || "/images/logotipo.svg"} width={36} height={36} alt={u.title} className="rounded" />
                  <div className="flex-1">
                    <div className="font-medium">{u.title}</div>
                    <div className="text-xs text-muted">{u.artist}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
