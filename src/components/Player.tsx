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
  Share2,
} from "lucide-react";
import { SiWhatsapp, SiX, SiFacebook } from "@icons-pack/react-simple-icons";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
import { buildStreamUrl, RADIO_CONFIG } from "@/config";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";
import { useLive } from "@/context/LiveContext";
import { socket } from "@/lib/socket";

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

function AdminLiveButton() {
  const { isAuthenticated } = useAuth();
  const { live, djName } = useLive();
  const [showPrompt, setShowPrompt] = useState(false);
  const [name, setName] = useState("");

  const toggleLive = useCallback(
    async (newLive: boolean, newDjName?: string) => {
      try {
        const res = await fetch("/api/admin/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ live: newLive, djName: newDjName || "" }),
        });
        if (!res.ok) throw new Error("Falha");
        toast.success(newLive ? "Modo ao vivo ativado" : "Modo ao vivo desativado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro");
      }
    },
    [],
  );

  const handleClick = useCallback(() => {
    if (live) {
      toggleLive(false);
    } else {
      setName("");
      setShowPrompt(true);
    }
  }, [live, toggleLive]);

  const handleConfirm = useCallback(() => {
    toggleLive(true, name.trim());
    setShowPrompt(false);
  }, [name, toggleLive]);

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={handleClick}
        title={live ? `Ao vivo${djName ? `: ${djName}` : ""} — clique para desativar` : "Ativar modo ao vivo"}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
          live
            ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        <Radio size={14} />
      </button>

      {showPrompt && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setShowPrompt(false)}
            aria-label="Fechar"
          />
          <div className="absolute right-0 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 p-3 min-w-52 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-slate-300 mb-2">Nome do DJ (opcional):</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: DJ Lucas"
              className="w-full px-2 py-1.5 text-xs bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 mb-2"
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            <button
              onClick={handleConfirm}
              className="w-full px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
            >
              Entrar ao vivo
            </button>
          </div>
        </>
      )}
    </>
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
    songId,
    setSong,
    updateCover,
  } = useAudio();
  const { currentGenre, setGenre, getStreamUrl } = useGenre();
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [listeners, setListeners] = useState<ListenersData>({
    current: 0,
    peak: 0,
  });
  const [nextSong, setNextSong] = useState<{
    title: string;
    artist: string;
  } | null>(null);
  const [shareMode, setShareMode] = useState<"current" | "next">("next");

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

  // Buscar próxima música
  const fetchNextSong = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/next?genre=${currentGenre}`);
      if (!res.ok) return;
      const data = await res.json();
      const next = data.upcoming?.[0] || data.nextIfNoRequests || null;
      setNextSong(next ? { title: next.title, artist: next.artist } : null);
    } catch {
      // silencioso
    }
  }, [currentGenre]);

  // Buscar metadados na inicialização e ao trocar de gênero
  useEffect(() => {
    fetchMetadata();
    fetchListeners();
    fetchNextSong();

    // Poll de metadados e ouvintes a cada 10 segundos
    const interval = setInterval(() => {
      fetchMetadata();
      fetchListeners();
    }, RADIO_CONFIG.metadataRefreshInterval);

    return () => clearInterval(interval);
  }, [fetchMetadata, fetchListeners, fetchNextSong]);

  // Atualizar próxima música e capa via socket
  useEffect(() => {
    const onSongChanged = (data: {
      id?: number;
      title?: string;
      artist?: string;
      cover?: string;
      playedOnMountpoint?: string;
    }) => {
      fetchNextSong();
      // Atualizar capa instantaneamente via socket (sem esperar poll de 10s)
      if (
        data.playedOnMountpoint === currentGenre &&
        data.title &&
        data.artist
      ) {
        setSong({
          id: data.id,
          title: data.title,
          artist: data.artist,
          cover: data.cover || "/images/logotipo.svg",
        });
      }
    };
    const onCoverUpdate = (data: { songId: number; cover: string }) => {
      if (data.songId === songId && data.cover) {
        updateCover(data.cover);
      }
    };
    socket.on("song:changed", onSongChanged);
    socket.on("song:cover", onCoverUpdate);
    socket.on("request:added", fetchNextSong);
    socket.on("request:removed", fetchNextSong);
    return () => {
      socket.off("song:changed", onSongChanged);
      socket.off("song:cover", onCoverUpdate);
      socket.off("request:added", fetchNextSong);
      socket.off("request:removed", fetchNextSong);
    };
  }, [fetchNextSong, currentGenre, setSong, songId, updateCover]);

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

  const songToShare =
    shareMode === "current"
      ? { title, artist }
      : nextSong
        ? { title: nextSong.title, artist: nextSong.artist }
        : null;

  const shareText = songToShare
    ? `🎶 ${shareMode === "current" ? "Toca agora" : "Já já toca"} "${songToShare.title}" de ${songToShare.artist} na Som do Mato! Vem ouvir ao vivo e sentir a emoção do sertanejo! 🤠🔥\n\nhttps://somdomato.com`
    : null;

  const shareLinks = shareText
    ? {
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
        x: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}&u=${encodeURIComponent("https://somdomato.com")}`,
      }
    : null;

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

        {/* Compartilhar música */}
        {shareLinks && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              className="hidden sm:flex w-7 h-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Compartilhar música"
              title="Compartilhar música"
            >
              <Share2 size={13} />
            </button>

            {showShareDropdown && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareDropdown(false)}
                  aria-label="Fechar"
                />
                <div className="absolute right-0 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-3 min-w-52">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition">
                        <input
                          type="radio"
                          name="share-mode"
                          value="current"
                          checked={shareMode === "current"}
                          onChange={() => setShareMode("current")}
                          className="w-3 h-3 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-slate-400">
                            Música atual
                          </div>
                          <div className="text-[10px] text-white font-medium truncate">
                            {title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {artist}
                          </div>
                        </div>
                      </label>

                      {nextSong && (
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition">
                          <input
                            type="radio"
                            name="share-mode"
                            value="next"
                            checked={shareMode === "next"}
                            onChange={() => setShareMode("next")}
                            className="w-3 h-3 accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-slate-400">
                              Próxima música
                            </div>
                            <div className="text-[10px] text-white font-medium truncate">
                              {nextSong.title}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {nextSong.artist}
                            </div>
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-3">
                      <p className="text-[9px] text-slate-500 mb-2 px-1">
                        Compartilhar em:
                      </p>
                      <div className="flex items-center gap-2 justify-center">
                        <a
                          href={shareLinks.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowShareDropdown(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#25D366]/20 hover:bg-[#25D366]/40 transition"
                          title="WhatsApp"
                        >
                          <SiWhatsapp size={16} className="text-[#25D366]" />
                        </a>
                        <a
                          href={shareLinks.x}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowShareDropdown(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
                          title="X"
                        >
                          <SiX size={14} className="text-white" />
                        </a>
                        <a
                          href={shareLinks.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowShareDropdown(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1877F2]/20 hover:bg-[#1877F2]/40 transition"
                          title="Facebook"
                        >
                          <SiFacebook size={16} className="text-[#1877F2]" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Botão de Skip (admin) */}
        <AdminSkipButton />
        {/* Botão de Ao Vivo (admin) */}
        <AdminLiveButton />
      </div>
    </div>
  );
}
