"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useGenre } from "@/context/GenreContext";
import SongBlock from "./SongBlock";
import SongList from "./SongList";
import { CircleArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { isJingleMetadata } from "@/lib/song-visibility";

type LatestEntry = {
  historyId?: number;
  id: number;
  title: string;
  artist: string;
  cover: string | null;
  playedAt?: number | null;
};

export default function Last({ data }: { data: LatestEntry[] }) {
  const [latest, setLatest] = useState<LatestEntry[]>(data);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const { currentGenre } = useGenre();

  useEffect(() => setMounted(true), []);

  // Recarregar dados quando o gênero mudar
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/songs/last?genre=${currentGenre}`);
        if (res.ok) {
          const data = await res.json();
          setLatest(data);
        }
      } catch (err) {
        console.warn("Erro ao buscar últimas músicas:", err);
      }
    };

    fetchLatest();
  }, [currentGenre]);

  useEffect(() => {
    // `song:changed` é emitido quando uma música COMEÇA a tocar (vira
    // "current" no banco) — ela ainda não foi tocada, então NÃO deve entrar
    // em "Últimas" aqui. Em vez de inserir a música recebida no evento,
    // refazemos a busca no servidor: nesse momento o banco já rebaixou a
    // música anterior para "played" (ver `setCurrent` em lib/queue.ts), que
    // é a que de fato deve aparecer no topo de "Últimas".
    const onSongChanged = (song: {
      title: string;
      artist: string;
      genre?: string;
      playedOnMountpoint?: string;
    }) => {
      if (isJingleMetadata({ title: song.title, artist: song.artist })) {
        return;
      }

      // Filtrar pelo mountpoint onde a música foi TOCADA
      const mountpoint = song.playedOnMountpoint || song.genre || "geral";
      if (mountpoint !== currentGenre) {
        return;
      }

      fetch(`/api/songs/last?genre=${currentGenre}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setLatest(data);
        })
        .catch((err) => console.warn("Erro ao buscar últimas músicas:", err));
    };

    socket.on("song:changed", onSongChanged);
    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, [currentGenre]);

  // Atualizar tempos relativos a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SongBlock icon={CircleArrowLeft} title="Últimas">
      {latest.length === 0 ? (
        <div className="text-muted text-sm">
          Nenhuma música tocada ainda neste gênero.
        </div>
      ) : (
        <SongList
          items={latest}
          keyField="historyId"
          renderRight={(item) =>
            mounted ? formatRelativeTime((item as LatestEntry).playedAt) : ""
          }
        />
      )}
    </SongBlock>
  );
}
