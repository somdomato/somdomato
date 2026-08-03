"use client";

import { useState, useEffect } from "react";
import { socket } from "@/lib/socket";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { Trophy } from "lucide-react";

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
    // `song:changed` é emitido quando uma música COMEÇA a tocar — nesse
    // momento a música anterior já foi rebaixada para "played" no banco
    // (ver `setCurrent` em lib/queue.ts). O TOP 10 só deve contar pedidos
    // efetivamente tocados, então refazemos a busca no servidor em vez de
    // incrementar otimisticamente no `request:added` (que dispara antes de
    // a música tocar e inflava as contagens).
    const onSongChanged = () => {
      fetch("/api/songs/top")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setTop(data);
        })
        .catch((err) => console.warn("Erro ao buscar top 10:", err));
    };

    socket.on("song:changed", onSongChanged);
    return () => {
      socket.off("song:changed", onSongChanged);
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
