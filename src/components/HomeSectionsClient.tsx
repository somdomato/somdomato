"use client";

import React from "react";
import Image from "next/image";
import { socket } from "@/lib/socket";

type TopEntry = { id: number; title: string; artist: string; cover: string | null; count: number };
type LatestEntry = { id: number; title: string; artist: string; cover: string | null; playedAt?: number | null };
type UpcomingEntry = { reqId: number; id: number; title: string; artist: string; cover: string | null; requestedAt?: number | null };

export default function HomeSectionsClient({ initialLatest, initialTop, initialUpcoming, initialNextIfNoRequests }: { initialLatest: LatestEntry[]; initialTop: TopEntry[]; initialUpcoming: UpcomingEntry[]; initialNextIfNoRequests: UpcomingEntry | null }) {
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
          return prev
            .map((p) => (p.id === song.id ? { ...p, count: p.count + 1 } : p))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
        // if not found, add with count=1, then sort by count and keep top 10
        const added: TopEntry = { id: song.id, title: song.title, artist: song.artist, cover: song.cover || null, count: 1 };
        return [added, ...prev].sort((a, b) => b.count - a.count).slice(0, 10);
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

    const onRequestAdded = (req: { reqId?: number; id?: number; title?: string; artist?: string; cover?: string | null; requestedAt?: number | null } | unknown) => {
      // If server emits a full payload, integrate it locally to avoid refetch
      if (req && typeof req === "object" && req !== null && "reqId" in req) {
        const r = req as { reqId: number; id: number; title: string; artist: string; cover?: string | null; requestedAt?: number | null };
        setUpcoming((prev) => {
          if (prev.some((p) => p.reqId === r.reqId)) return prev; // avoid duplicates
          return [...prev, { reqId: r.reqId, id: r.id, title: r.title, artist: r.artist, cover: r.cover ?? null, requestedAt: r.requestedAt ?? Date.now() }].slice(-10);
        });
        return;
      }

      // fallback: refetch full list
      fetchUpcoming();
    };

    socket.on("song:changed", onSongChanged);
    socket.on("request:removed", onRequestRemoved);
    socket.on("request:added", onRequestAdded);
    socket.on("requests:updated", fetchUpcoming);

    return () => {
      socket.off("song:changed", onSongChanged);
      socket.off("request:removed", onRequestRemoved);
      socket.off("request:added", onRequestAdded);
      socket.off("requests:updated", fetchUpcoming);
    };
  }, [fetchUpcoming]);

  return (
    <section className="mt-6 max-w-4xl mx-auto w-full px-2 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <div className="bg-background-alt border border-primary/20 rounded p-3">
          <h3 className="font-semibold mb-3">Próximas</h3>
          {upcoming.length === 0 ? (
            nextIfNoRequests ? (
              <div className="flex items-center gap-3">
                <Image src={nextIfNoRequests.cover || "/images/logotipo.svg"} width={36} height={36} alt={nextIfNoRequests.title} className="rounded" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{nextIfNoRequests.title}</div>
                  <div className="text-xs text-muted truncate">{nextIfNoRequests.artist} • selecionada pelo AutoDJ</div>
                </div>
              </div>
            ) : (
              <div className="text-muted text-sm">Sem pedidos pendentes.</div>
            )
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-10" />
                  <col />
                </colgroup>
                <tbody>
                  {upcoming.map((u) => (
                    <tr key={u.reqId} className="border-t">
                      <td className="py-2 pr-3 align-top">
                        <div className="w-9 h-9 relative rounded overflow-hidden">
                          <Image src={u.cover || "/images/logotipo.svg"} width={36} height={36} alt={u.title} className="rounded" />
                        </div>
                      </td>
                      <td className="py-2 min-w-0">
                        <div className="font-medium truncate">{u.title}</div>
                        <div className="text-xs text-muted truncate">{u.artist}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
