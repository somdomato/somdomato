"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX, Radio } from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
import { buildStreamUrl, RADIO_CONFIG } from "@/config";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";

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

  const currentGenreLabel =
    GENRES.find((g) => g.value === currentGenre)?.label || "Geral";

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

    // Poll de metadados a cada 10 segundos
    const interval = setInterval(
      fetchMetadata,
      RADIO_CONFIG.metadataRefreshInterval,
    );

    return () => clearInterval(interval);
  }, [fetchMetadata]);

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
      className={`flex items-center gap-2 sm:gap-3 max-w-2xl bg-linear-to-r from-background-alt to-[#2c3b26] rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-primary/30 shadow-lg ${className}`}
    >
      {/* Cover Image */}
      <div className="shrink-0">
        <Image
          src={cover}
          alt="Cover"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded border border-primary/40 object-cover"
          width={48}
          height={48}
        />
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xs sm:text-sm font-medium text-white truncate"
          title={title}
        >
          {title}
        </div>
        {loading && playing ? (
          <div className="flex items-center gap-1 text-xs text-primary animate-pulse">
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
          <div className="text-xs text-slate-400 truncate" title={artist}>
            {artist}
          </div>
        )}
      </div>

      {/* Station Selector */}
      {RADIO_CONFIG.multipleMounts && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowGenreDropdown(!showGenreDropdown)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 transition-all group"
            title="Trocar estação"
          >
            <Radio
              size={14}
              className="text-primary group-hover:scale-110 transition-transform"
            />
            <span className="text-xs sm:text-sm font-medium text-white max-w-16 sm:max-w-none truncate">
              {currentGenreLabel}
            </span>
            <svg
              className={`w-3 h-3 sm:w-4 sm:h-4 text-primary transition-transform duration-200 ${showGenreDropdown ? "rotate-180" : ""}`}
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
              <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 min-w-44 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1">
                  {GENRES.map((genre) => (
                    <button
                      key={genre.value}
                      type="button"
                      onClick={() => handleGenreChange(genre)}
                      className={`w-full px-3 py-2.5 text-left text-sm rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2.5 ${currentGenre === genre.value ? "bg-primary/15 text-primary font-semibold" : "text-white"}`}
                    >
                      <Radio
                        size={14}
                        className={
                          currentGenre === genre.value
                            ? "text-primary"
                            : "text-slate-400"
                        }
                      />
                      <span>{genre.label}</span>
                      {currentGenre === genre.value && (
                        <span className="ml-auto text-xs bg-primary/30 px-1.5 py-0.5 rounded">
                          Ouvindo
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 shadow-md"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <Pause size={18} className="sm:w-5 sm:h-5" />
          ) : (
            <Play size={18} className="ml-0.5 sm:w-5 sm:h-5" />
          )}
        </button>

        {/* Reload Stream */}
        <button
          type="button"
          onClick={handleReload}
          disabled={!playing}
          className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Recarregar stream"
        >
          <RotateCw size={14} className="sm:w-4 sm:h-4" />
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => toggleMute()}
          className="hidden sm:flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? (
            <VolumeX size={14} className="sm:w-4 sm:h-4" />
          ) : (
            <Volume2 size={14} className="sm:w-4 sm:h-4" />
          )}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number.parseInt(e.target.value, 10))}
          style={{ "--value": `${muted ? 0 : volume}%` } as React.CSSProperties}
          className="hidden lg:block w-14 sm:w-16 accent-primary"
          aria-label="Volume"
        />

        {/* Botão de Skip (admin) */}
        <AdminSkipButton />
      </div>
    </div>
  );
}
