"use client";

import CoverImage from "@/components/CoverImage";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Radio,
  Share2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { SiWhatsapp, SiX, SiFacebook } from "@icons-pack/react-simple-icons";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
import { buildStreamUrl, RADIO_CONFIG } from "@/config";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";
import { socket } from "@/lib/socket";
import { isJingleMetadata } from "@/lib/song-visibility";

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
      className="w-7 h-7 flex items-center justify-center rounded-full bg-primary text-black hover:bg-primary-alt transition"
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

export default function Player({
  className = "",
  hideExtras = false,
}: {
  className?: string;
  hideExtras?: boolean;
}) {
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
  const lastSocketSongUpdate = useRef<number>(0);

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
        // Ignorar se o socket atualizou a música nos últimos 5s para evitar race condition
        const isSameSong =
          data.song?.title === title && data.song?.artist === artist;
        if (
          data.song &&
          !isSameSong &&
          Date.now() - lastSocketSongUpdate.current > 5000
        ) {
          setSong(data.song);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar metadados:", error);
    }
  }, [currentGenre, setSong, title, artist]);

  // Buscar próxima música
  const fetchNextSong = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/next?genre=${currentGenre}`);
      if (!res.ok) return;
      const data = await res.json();
      const next = data.upcoming?.[0] || null;
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
      if (isJingleMetadata({ title: data.title, artist: data.artist })) {
        return;
      }

      // Atualizar capa instantaneamente via socket (sem esperar poll de 10s)
      if (
        data.playedOnMountpoint === currentGenre &&
        data.title &&
        data.artist
      ) {
        lastSocketSongUpdate.current = Date.now();
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
    ? `🎶 ${shareMode === "current" ? "Tocando agora" : "Já já toca"} "*${songToShare.artist} - ${songToShare.title}*" na Rádio Som do Mato!\n\nVem ouvir e sentir a emoção do sertanejo! 🤠🔥\n\nhttps://somdomato.com`
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
      className={
        hideExtras
          ? `flex items-center gap-3 bg-black/30 p-2 ${className}`
          : `flex items-center gap-1.5 max-w-xl bg-black/20 rounded-lg p-2 border-2 border-white/20 ${className}`
      }
    >
      {/* Cover Image */}
      <div
        className={`shrink-0 relative overflow-hidden ${
          hideExtras
            ? "w-11 h-11 rounded-lg"
            : "w-9 h-9 sm:w-10 sm:h-10 rounded-md"
        }`}
      >
        <CoverImage
          src={cover}
          alt="Cover"
          fill
          sizes="48px"
          className="object-cover"
        />
        {hideExtras && playing && !loading && (
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-2.5">
            <span
              className="w-0.5 rounded-full bg-primary equalizer-bar"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-0.5 rounded-full bg-primary equalizer-bar"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="w-0.5 rounded-full bg-primary equalizer-bar"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div
          className={
            hideExtras
              ? "text-xs font-semibold text-white truncate leading-tight"
              : "text-[10px] sm:text-[11px] font-medium text-white/90 truncate leading-tight"
          }
          title={title}
        >
          {title}
        </div>
        {loading && playing ? (
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <div className="w-3 h-3 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span>Carregando</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className={
                hideExtras
                  ? "text-[11px] text-white/60 truncate"
                  : "text-[9px] sm:text-[10px] text-white/50 truncate"
              }
              title={artist}
            >
              {artist}
            </span>
            {listeners.current > 0 && (
              <div className="relative w-fit">
                <div className="peer flex items-center gap-1 text-[0.6em] cursor-pointer">
                  <UsersRound size={8} className="text-white/50" />{" "}
                  {listeners.current}
                  <TrendingUp size={8} className="text-white/50" />{" "}
                  {listeners.peak}
                </div>
                <span
                  className="bottom-full -translate-y-0.5
                    border-2 border-stone-800 rounded-md 
                    peer-hover:-translate-y-1 peer-hover:opacity-100
                    absolute w-max left-1/2 -translate-x-1/2
                    text-stone-50 text-sm bg-stone-800 opacity-0 p-2
                    transition-all"
                >
                  Ouvintes: {listeners.current} Pico: {listeners.peak}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Station Selector */}
      {RADIO_CONFIG.multipleMounts && !hideExtras && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowGenreDropdown(!showGenreDropdown)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/6 hover:bg-white/10 border border-white/10 transition-all group"
            title="Trocar estação"
          >
            <Radio
              size={10}
              className="text-white/50 group-hover:text-white/70 transition-colors"
            />
            <span className="text-[10px] sm:text-[11px] text-white/70 max-w-12 sm:max-w-none truncate">
              {currentGenreLabel}
            </span>
            <svg
              className={`w-2.5 h-2.5 text-white/40 transition-transform duration-200 ${showGenreDropdown ? "rotate-180" : ""}`}
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
              <div className="absolute right-0 min-w-38 sm:left-1/2 sm:-translate-x-1/2 top-full mt-1.5 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1 space-y-0.5">
                  {GENRES.map((genre) => (
                    <button
                      key={genre.value}
                      type="button"
                      onClick={() => handleGenreChange(genre)}
                      className={`w-full px-2.5 py-2 text-left text-[11px] rounded-md transition-colors flex items-center gap-2 ${currentGenre === genre.value ? "bg-white/10 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/6"}`}
                    >
                      <Radio
                        size={11}
                        className={`shrink-0 ${
                          currentGenre === genre.value
                            ? "text-primary"
                            : "text-white/30"
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
          className={
            hideExtras
              ? "w-9 h-9 flex items-center justify-center rounded-full bg-primary text-black hover:bg-primary-alt transition-all active:scale-95"
              : "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-primary text-black hover:bg-primary-alt transition-all active:scale-95"
          }
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <Pause size={hideExtras ? 16 : 13} />
          ) : (
            <Play size={hideExtras ? 16 : 13} className="ml-0.5" />
          )}
        </button>

        {/* Reload Stream */}
        <button
          type="button"
          onClick={handleReload}
          disabled={!playing}
          className={`${hideExtras ? "flex" : "hidden sm:flex"} w-6 h-6 items-center justify-center rounded-full text-white/70 hover:text-white/80 hover:bg-white/20 transition disabled:opacity-25 disabled:cursor-not-allowed`}
          aria-label="Recarregar stream"
        >
          <RotateCw size={12} />
        </button>

        {/* Volume */}
        <button
          type="button"
          onClick={() => toggleMute()}
          className="hidden sm:flex w-6 h-6 items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/8 transition"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
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
        {shareLinks && !hideExtras && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              className="hidden sm:flex w-6 h-6 items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/8 transition"
              aria-label="Compartilhar música"
              title="Compartilhar música"
            >
              <Share2 size={12} />
            </button>

            {showShareDropdown && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  onClick={() => setShowShareDropdown(false)}
                  aria-label="Fechar"
                />
                <div className="absolute right-0 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-3 w-52 max-w-[calc(100vw-1.5rem)]">
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
      </div>
    </div>
  );
}
