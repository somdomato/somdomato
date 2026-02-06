"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX, Radio } from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
import { buildStreamUrl } from "@/lib/radio";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";
import { useCallback } from "react";

function AdminSkipButton() {
  const { isAuthenticated, password } = useAuth();
  const handle = useCallback(async () => {
    if (!isAuthenticated || !password) {
      toast.error("Somente admins");
      return;
    }
    try {
      const res = await fetch("/api/admin/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao enviar skip");
      toast.success("Skip enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar skip");
      console.error(err);
    }
  }, [isAuthenticated, password]);

  if (!isAuthenticated) return null;

  return (
    <button
      onClick={handle}
      title="Skip (admin)"
      className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-500 text-black hover:opacity-90 transition"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4v16l12-8z"></path>
        <line x1="6" y1="4" x2="6" y2="20"></line>
      </svg>
    </button>
  );
}

interface IcecastPlayerProps {
  streamUrl?: string;
  coverImage?: string;
  className?: string;
}

const DEFAULT_TITLE = "Rádio Som do Mato";
const DEFAULT_COVER = "/images/logotipo.svg";

export default function IcecastPlayer({ className = "" }: IcecastPlayerProps) {
  const {
    playing,
    play,
    pause,
    volume,
    setVolume,
    muted,
    toggleMute,
    title,
    artist,
    cover,
    setTitle,
    setArtist,
    setCover,
  } = useAudio();
  const { currentGenre, setGenre, getStreamUrl } = useGenre();
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  const currentGenreLabel =
    GENRES.find((g) => g.value === currentGenre)?.label || "Geral";

  // Simplificar: usar apenas Socket.io para metadados
  useEffect(() => {
    const handleSongChanged = (nextSong: {
      id: number;
      title: string;
      artist: string;
      cover?: string;
    }) => {
      setTitle(nextSong.title || DEFAULT_TITLE);
      setArtist(nextSong.artist || "A mais sertaneja");
      setCover(nextSong.cover || DEFAULT_COVER);
    };

    socket.on("song:changed", handleSongChanged);
    return () => {
      socket.off("song:changed", handleSongChanged);
    };
  }, [setTitle, setArtist, setCover]);

  return (
    <div
      className={`flex items-center justify-between gap-3 max-w-2xl bg-linear-to-r from-background-alt to-[#2c3b26] rounded-lg px-3 py-2 border-2 border-black/50 ${className}`}
    >
      {/* Cover Image */}
      <div className="shrink-0">
        <Image
          src={cover}
          alt="Cover"
          className="w-12 h-12 sm:w-14 sm:h-14 rounded border-2 border-primary/40 object-cover"
          width={56}
          height={56}
        />
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate" title={title}>
          {title}
        </div>
        <div className="text-xs text-slate-400 truncate" title={artist}>
          {artist}
        </div>
      </div>

      {/* Station Selector - VISÍVEL E CLARO */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowGenreDropdown(!showGenreDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 transition-all group"
          title="Trocar estação"
        >
          <Radio
            size={16}
            className="text-primary group-hover:scale-110 transition-transform"
          />
          <span className="hidden sm:inline text-sm font-medium text-white">
            {currentGenreLabel}
          </span>
          <svg
            className="w-4 h-4 text-primary transition-transform group-hover:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {showGenreDropdown && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              onClick={() => setShowGenreDropdown(false)}
              aria-label="Fechar"
            />
            <div className="absolute right-0 top-full mt-2 bg-background-alt border-2 border-primary/50 rounded-lg shadow-2xl z-50 min-w-50 overflow-hidden">
              {GENRES.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => {
                    setGenre(genre.value);
                    const streamUrl = buildStreamUrl(
                      genre.mountpoint,
                      process.env.NEXT_PUBLIC_RADIO_SOURCE,
                    );
                    // Fechar dropdown e iniciar stream
                    setShowGenreDropdown(false);
                    play(streamUrl);
                    toast.success(`Estação: ${genre.label}`);
                  }}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-primary/20 transition-colors flex items-center gap-3 ${currentGenre === genre.value ? "bg-primary/10 text-primary font-semibold" : "text-white"}`}
                >
                  <Radio size={16} />
                  <span>{genre.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => {
            const streamUrl = getStreamUrl();
            if (playing) {
              pause();
            } else {
              play(streamUrl);
            }
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <Pause size={20} />
          ) : (
            <Play size={20} className="ml-0.5" />
          )}
        </button>

        {/* Reload Stream */}
        <button
          type="button"
          onClick={() => {
            const streamUrl = getStreamUrl();
            if (playing) {
              pause();
              setTimeout(() => play(streamUrl), 100);
              toast.success("Stream recarregada");
            }
          }}
          disabled={!playing}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Recarregar stream"
        >
          <RotateCw size={16} />
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => toggleMute()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number.parseInt(e.target.value, 10))}
          style={{ "--value": `${muted ? 0 : volume}%` } as React.CSSProperties}
          className="w-16 sm:w-20 accent-primary"
          aria-label="Volume"
        />

        {/* Botão de Skip (admin) */}
        <AdminSkipButton />
      </div>
    </div>
  );
}
