"use client";

import { useState, useEffect, useCallback } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

type UpcomingEntry = {
  reqId: number;
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  requestedAt?: number | null;
};

export default function Next({
  data,
  initialNextIfNoRequests,
}: {
  data: UpcomingEntry[];
  initialNextIfNoRequests: UpcomingEntry | null;
}) {
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>(data);
  const [nextIfNoRequests, setNextIfNoRequests] =
    useState<UpcomingEntry | null>(initialNextIfNoRequests);
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
    const onRequestRemoved = (req: {
      requestId?: number;
      id?: number;
      reqId?: number;
    }) => {
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

  // Para gênero "geral": mostrar próxima do AutoDJ + pedidos
  // Para outros gêneros: mostrar apenas próxima do AutoDJ
  if (currentGenre !== "geral") {
    return (
      <SongBlock icon={CircleArrowRight} title="Próximas">
        {nextIfNoRequests ? (
          <SongList
            items={[
              {
                id: nextIfNoRequests.id,
                title: nextIfNoRequests.title,
                artist: nextIfNoRequests.artist,
                cover: nextIfNoRequests.cover,
              },
            ]}
            renderRight={() => (
              <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                AutoDJ
              </span>
            )}
          />
        ) : (
          <div className="text-muted text-sm">Calculando próxima música...</div>
        )}
      </SongBlock>
    );
  }

  // Para "geral": mostrar AutoDJ primeiro, depois os pedidos
  // Construir lista ordenada: AutoDJ -> Pedidos
  const allItems: UpcomingEntry[] = [];

  // Adicionar próxima do AutoDJ primeiro (se existir)
  if (nextIfNoRequests) {
    allItems.push({
      reqId: -1,
      id: nextIfNoRequests.id,
      title: nextIfNoRequests.title,
      artist: nextIfNoRequests.artist,
      cover: nextIfNoRequests.cover,
      requestedAt: null,
    });
  }

  // Adicionar pedidos depois
  allItems.push(...upcoming);

  return (
    <SongBlock icon={CircleArrowRight} title="Próximas">
      {allItems.length === 0 ? (
        <div className="text-muted text-sm">Calculando próxima música...</div>
      ) : (
        <SongList
          items={allItems}
          keyField="reqId"
          renderRight={(item) => {
            const entry = item as UpcomingEntry;
            // Se reqId=-1, é a próxima do AutoDJ
            if (entry.reqId === -1) {
              return (
                <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                  AutoDJ
                </span>
              );
            }
            // Pedido: mostrar tempo relativo + badge
            return (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {formatRelativeTime(entry.requestedAt)}
                </span>
                <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
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
