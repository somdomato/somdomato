"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Radio,
  Users,
} from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
import { buildStreamUrl, RADIO_CONFIG } from "@/config";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";

type ListenersData = {
  current: number;
  peak: number;
};

function AdminSkipButton() {
  const { isAuthenticated } = useAuth();
  const handle = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error("Somente admins");
      return;
    }
    try {
      const res = await fetch("/api/admin/skip", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao enviar skip");
      toast.success("Skip enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar skip");
      console.error(err);
    }
  }, [isAuthenticated]);

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

export default function Player({ className = "" }: { className?: string }) {
  const {
    playing,
    loading,
    play,
    pause,
    volume,
    setVolume,
    muted,
    toggleMute,
    title,
    artist,
    cover,
    setSong,
  } = useAudio();
  const { currentGenre, setGenre, getStreamUrl } = useGenre();
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [listeners, setListeners] = useState<ListenersData>({
    current: 0,
    peak: 0,
  });

  const currentGenreLabel =
    GENRES.find((g) => g.value === currentGenre)?.label || "Geral";

  // Buscar ouvintes do mountpoint atual
  const fetchListeners = useCallback(async () => {
    try {
      const response = await fetch("/api/listeners");
      if (response.ok) {
        const data = await response.json();
        const currentMount = data.mountpoints?.find(
          (m: { mountpoint: string }) => m.mountpoint === currentGenre,
        );
        if (currentMount) {
          setListeners({
            current: currentMount.listeners || 0,
            peak: currentMount.peak || 0,
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar ouvintes:", error);
    }
  }, [currentGenre]);

  // Buscar metadados do gênero atual
  const fetchMetadata = useCallback(async () => {
    try {
      const response = await fetch(`/api/metadata?genre=${currentGenre}`);
      if (response.ok) {
        const data = await response.json();
        if (data.song) {
          setSong(data.song);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar metadados:", error);
    }
  }, [currentGenre, setSong]);

  // Buscar metadados na inicialização e ao trocar de gênero
  useEffect(() => {
    fetchMetadata();
    fetchListeners();

    // Poll de metadados e ouvintes a cada 10 segundos
    const interval = setInterval(() => {
      fetchMetadata();
      fetchListeners();
    }, RADIO_CONFIG.metadataRefreshInterval);

    return () => clearInterval(interval);
  }, [fetchMetadata, fetchListeners]);

  const handleGenreChange = useCallback(
    async (newGenre: (typeof GENRES)[number]) => {
      setGenre(newGenre.value);
      setShowGenreDropdown(false);

      const streamUrl = buildStreamUrl(newGenre.mountpoint);

      // Iniciar playback imediatamente
      await play(streamUrl);

      // Buscar metadados do novo gênero
      try {
        const response = await fetch(`/api/metadata?genre=${newGenre.value}`);
        if (response.ok) {
          const data = await response.json();
          if (data.song) {
            setSong(data.song);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar metadados:", error);
      }

      toast.success(`Estação: ${newGenre.label}`);
    },
    [setGenre, play, setSong],
  );

  const handlePlayPause = useCallback(() => {
    if (playing) {
      pause();
    } else {
      const streamUrl = getStreamUrl();
      play(streamUrl);
    }
  }, [playing, pause, play, getStreamUrl]);

  const handleReload = useCallback(() => {
    if (playing) {
      const streamUrl = getStreamUrl();
      pause();
      setTimeout(() => play(streamUrl), 100);
      toast.success("Stream recarregada");
    }
  }, [playing, pause, play, getStreamUrl]);

  return (
    <div
      className={`flex items-center gap-2 max-w-xl bg-linear-to-r from-background-alt to-[#2c3b26] rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 border border-primary/30 shadow-lg ${className}`}
    >
      {/* Cover Image */}
      <div className="shrink-0">
        <Image
          src={cover}
          alt="Cover"
          className="w-8 h-8 sm:w-10 sm:h-10 rounded border border-primary/40 object-cover"
          width={40}
          height={40}
        />
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] sm:text-xs font-medium text-white truncate leading-tight"
          title={title}
        >
          {title}
        </div>
        {loading && playing ? (
          <div className="flex items-center gap-1 text-[10px] text-primary animate-pulse">
            <span>Carregando</span>
            <span className="inline-flex">
              <span
                className="animate-bounce"
                style={{ animationDelay: "0ms" }}
              >
                .
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: "150ms" }}
              >
                .
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: "300ms" }}
              >
                .
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] sm:text-xs text-slate-400 truncate"
              title={artist}
            >
              {artist}
            </span>
            {listeners.current > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded leading-none"
                title={`Pico: ${listeners.peak}`}
              >
                <Users size={9} />
                {listeners.current}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Station Selector */}
      {RADIO_CONFIG.multipleMounts && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowGenreDropdown(!showGenreDropdown)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 transition-all group"
            title="Trocar estação"
          >
            <Radio
              size={12}
              className="text-primary group-hover:scale-110 transition-transform"
            />
            <span className="text-[11px] sm:text-xs font-medium text-white max-w-14 sm:max-w-none truncate">
              {currentGenreLabel}
            </span>
            <svg
              className={`w-3 h-3 text-primary transition-transform duration-200 ${showGenreDropdown ? "rotate-180" : ""}`}
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
              <div className="absolute right-0 min-w-38 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1 space-y-1">
                  {GENRES.map((genre) => (
                    <button
                      key={genre.value}
                      type="button"
                      onClick={() => handleGenreChange(genre)}
                      className={`w-full px-3 py-2.5 text-left text-xs rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2.5 ${currentGenre === genre.value ? "bg-primary/15 text-primary font-semibold" : "text-white"}`}
                    >
                      <Radio
                        size={14}
                        className={`shrink-0 ${
                          currentGenre === genre.value
                            ? "text-primary"
                            : "text-slate-400"
                        }`}
                      />
                      <span>{genre.label}</span>
                      {/* {currentGenre === genre.value && (
                        <span className="ml-auto text-xs/4 bg-primary/30 px-1.5 py-1 rounded">
                          Ouvindo
                        </span>
                      )} */}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 shadow-md"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <Pause size={16} className="sm:w-4.5 sm:h-4.5" />
          ) : (
            <Play size={16} className="ml-0.5 sm:w-4.5 sm:h-4.5" />
          )}
        </button>

        {/* Reload Stream */}
        <button
          type="button"
          onClick={handleReload}
          disabled={!playing}
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Recarregar stream"
        >
          <RotateCw size={13} />
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => toggleMute()}
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number.parseInt(e.target.value, 10))}
          style={{ "--value": `${muted ? 0 : volume}%` } as React.CSSProperties}
          className="hidden lg:block w-12 sm:w-14 accent-primary"
          aria-label="Volume"
        />

        {/* Botão de Skip (admin) */}
        <AdminSkipButton />
      </div>
    </div>
  );
}
