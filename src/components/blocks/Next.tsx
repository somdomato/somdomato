"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { socket } from "@/lib/socket";

type UpcomingEntry = { reqId: number; id: number; title: string; artist: string; cover: string | null; requestedAt?: number | null };

export default function HomeSectionsClient({ initialUpcoming, initialNextIfNoRequests }: { initialUpcoming: UpcomingEntry[]; initialNextIfNoRequests: UpcomingEntry | null }) {
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>(initialUpcoming);
  const [nextIfNoRequests] = useState<UpcomingEntry | null>(initialNextIfNoRequests);

  // Helper to fetch upcoming from public API endpoint
  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) return;
      const data = await res.json();
      setUpcoming(data.upcoming || []);
    } catch (err) {
      console.warn("fetchUpcoming failed:", err);
    }
  }, []);

  useEffect(() => {
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
  );
}
