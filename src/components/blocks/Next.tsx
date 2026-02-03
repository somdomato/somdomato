"use client";

import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

type UpcomingEntry = { reqId: number; id: number; title: string; artist: string; cover: string | null; requestedAt?: number | null };

export default function Next({ data, initialNextIfNoRequests }: { data: UpcomingEntry[]; initialNextIfNoRequests: UpcomingEntry | null }) {
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>(data);
  const [nextIfNoRequests, setNextIfNoRequests] = useState<UpcomingEntry | null>(initialNextIfNoRequests);
  const [, setTick] = useState(0);
  const { currentGenre } = useGenre();

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/next?genre=${currentGenre}`);
      if (!res.ok) return;
      const json = await res.json();
      setUpcoming(json.upcoming || []);
      setNextIfNoRequests(json.nextIfNoRequests || null);
    } catch (err) {
      console.warn("fetchUpcoming failed:", err);
    }
  }, [currentGenre]);

  // Recarregar quando o gênero mudar
  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

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
      // Pedidos só são relevantes para o gênero "geral"
      if (currentGenre !== "geral") return;
      
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

    const onSongChanged = () => {
      // Atualizar próxima música do AutoDJ
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
  }, [fetchUpcoming, currentGenre]);

  // Atualizar tempos relativos a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Para gênero "geral": mostrar pedidos ou próxima do AutoDJ
  // Para outros gêneros: mostrar apenas próxima do AutoDJ
  if (currentGenre !== "geral") {
    return (
      <SongBlock icon={CircleArrowRight} title="Próximas">
        {nextIfNoRequests ? (
          <SongList 
            items={[{ 
              id: nextIfNoRequests.id, 
              title: nextIfNoRequests.title, 
              artist: nextIfNoRequests.artist, 
              cover: nextIfNoRequests.cover 
            }]} 
            renderRight={() => "Próxima (AutoDJ)"} 
          />
        ) : (
          <div className="text-muted text-sm">Calculando próxima música...</div>
        )}
      </SongBlock>
    );
  }

  return (
    <SongBlock icon={CircleArrowRight} title="Próximas">
      {upcoming.length === 0 ? (
        nextIfNoRequests ? (
          <SongList items={[{ id: nextIfNoRequests.reqId ?? "auto", title: nextIfNoRequests.title, artist: nextIfNoRequests.artist, cover: nextIfNoRequests.cover, requestedAt: nextIfNoRequests.requestedAt ?? null }]} renderRight={(item) => formatRelativeTime(item.requestedAt as number | null)} />
        ) : (
          <div className="text-muted text-sm">Sem pedidos pendentes.</div>
        )
      ) : (
        <SongList items={upcoming} keyField="reqId" renderRight={(item) => formatRelativeTime((item as UpcomingEntry).requestedAt)} />
      )}
    </SongBlock>
  );
}
