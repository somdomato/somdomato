"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX, Music2 } from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { useGenre, GENRES } from "@/context/GenreContext";
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
    <button onClick={handle} title="Skip (admin)" className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-500 text-black hover:opacity-90 transition">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const { playing, play, pause, volume, setVolume, muted, toggleMute, title, artist, cover, setTitle, setArtist, setCover, previewActive } = useAudio();
  const { currentGenre, setGenre } = useGenre();
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  // Socket listener for song changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleSongChanged = async (nextSong: { id: number; title: string; artist: string; cover?: string }) => {
      // Debounce: cancela chamadas anteriores se houver
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        // Salvar dados no localStorage imediatamente
        localStorage.setItem(
          "nextSong",
          JSON.stringify({
            title: nextSong.title,
            artist: nextSong.artist,
            cover: nextSong.cover,
          }),
        );

        try {
          const response = await fetch("https://radio.somdomato.com/json");
          const {
            icestats: { source },
          } = await response.json();

          let iceArtist = source.artist;
          let iceTitle = source.title;

          if (!iceArtist && iceTitle?.includes(" - ")) {
            const [artist, ...titleParts] = iceTitle.split(" - ");
            iceArtist = artist.trim();
            iceTitle = titleParts.join(" - ").trim();
          }

          // Se o Icecast tiver dados válidos, usa eles
          // Caso contrário, usa os dados do localStorage
          const storedData = localStorage.getItem("nextSong");
          const parsedData = storedData ? JSON.parse(storedData) : null;

          const finalArtist = iceArtist && iceArtist !== "Unknown" ? iceArtist : parsedData?.artist || DEFAULT_TITLE;
          const finalTitle = iceTitle && iceTitle !== "Unknown" ? iceTitle : parsedData?.title || DEFAULT_TITLE;
          const finalCover = parsedData?.cover || DEFAULT_COVER;

          setTitle(finalTitle);
          setArtist(finalArtist);
          setCover(finalCover);

          // if (finalTitle !== DEFAULT_TITLE && finalArtist !== DEFAULT_TITLE) {
          //   toast.success(`Tocando agora: ${finalTitle} - ${finalArtist}`, { duration: 5000 });
          // }

          // Limpar dados após uso
          localStorage.removeItem("nextSong");
        } catch (error) {
          console.error("Error fetching song info:", error);

          // Se falhar a API do Icecast, usa os dados salvos do WebSocket
          const storedData = localStorage.getItem("nextSong");
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            setTitle(parsedData.title);
            setArtist(parsedData.artist);
            setCover(parsedData.cover || DEFAULT_COVER);
            //toast.success(`Tocando agora: ${parsedData.title} - ${parsedData.artist}`, { duration: 5000 });
            localStorage.removeItem("nextSong");
          }
        }
      }, 300); // Debounce de 300ms
    };

    socket.on("song:changed", handleSongChanged);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      socket.off("song:changed", handleSongChanged);
    };
  }, [setTitle, setArtist, setCover]);

  return (
    <div className={`flex items-center justify-between max-w-md gap-3 bg-gradient-to-r ${previewActive ? "from-slate-700 to-slate-800" : "from-background-alt to-[#2c3b26]"} rounded-md px-2 py-1.5 border-3 border-black/50 transition-colors duration-300 ${className}`}>
      {/* Cover Image with Genre Dropdown */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          className="relative w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden border-2 border-primary/40 cursor-pointer hover:border-primary transition-colors group"
          onClick={() => {
            console.log("Clicou na capa, showGenreDropdown:", showGenreDropdown);
            setShowGenreDropdown(!showGenreDropdown);
          }}
          aria-label="Selecionar gênero"
          title="Clique para trocar gênero"
        >
          <Image src={cover} alt="Cover" className="w-full h-full object-cover" width={32} height={32} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Music2 size={12} className="opacity-0 group-hover:opacity-100 text-white transition-opacity" />
          </div>
        </button>

        {/* Genre Dropdown */}
        {showGenreDropdown && (
          <>
            <button type="button" className="fixed inset-0 z-[55]" onClick={() => setShowGenreDropdown(false)} onKeyDown={(e) => e.key === "Escape" && setShowGenreDropdown(false)} aria-label="Fechar seletor de gênero" />
            <div className="absolute top-full left-0 mt-2 bg-background-alt border-2 border-primary/50 rounded-md shadow-2xl z-[60] min-w-[180px] overflow-hidden">
              {GENRES.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => {
                    console.log("Selecionou gênero:", genre.label);
                    setGenre(genre.value);
                    setShowGenreDropdown(false);
                    const baseUrl = process.env.NEXT_PUBLIC_RADIO_SOURCE || "https://radio.somdomato.com";
                    const streamUrl = `${baseUrl}/${genre.mountpoint}`;
                    if (playing) {
                      pause();
                      setTimeout(() => play(streamUrl), 100);
                    }
                    toast.success(`Gênero alterado para ${genre.label}`);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-primary/20 transition-colors flex items-center gap-2 first:rounded-t-md last:rounded-b-md ${currentGenre === genre.value ? "bg-primary/10 text-primary font-semibold" : "text-white"}`}
                >
                  <Music2 size={14} />
                  {genre.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div className="text-sm/3 text-white truncate cursor-pointer" title={title}>
          {title}
        </div>
        <div className="text-xs/3 text-slate-400/60 italic truncate cursor-pointer" title={artist}>
          {artist}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Play/Pause */}
        <button
          onClick={() => {
            if (playing) {
              pause();
            } else {
              const baseUrl = process.env.NEXT_PUBLIC_RADIO_SOURCE || "https://radio.somdomato.com";
              const streamUrl = `${baseUrl}/${GENRES.find((g) => g.value === currentGenre)?.mountpoint || "geral"}`;
              play(streamUrl);
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
        </button>

        {/* Reload */}
        <button
          onClick={() => {
            if (playing) {
              pause();
              const baseUrl = process.env.NEXT_PUBLIC_RADIO_SOURCE || "https://radio.somdomato.com";
              const streamUrl = `${baseUrl}/${GENRES.find((g) => g.value === currentGenre)?.mountpoint || "geral"}`;
              setTimeout(() => play(streamUrl), 100);
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-700/10 hover:bg-emerald-600/30 text-emerald-200 hover:text-white transition-all active:scale-95"
          aria-label="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Volume Controls */}
        <div className="hidden md:flex items-center gap-2 ml-1">
          <button onClick={() => toggleMute()} className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-700/10 hover:bg-emerald-600/30 text-emerald-200 hover:text-white transition-all active:scale-95" aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => {
              const newVolume = Number(e.target.value);
              setVolume(newVolume);
              if (newVolume > 0) {
                toggleMute(false);
              } else if (newVolume === 0) {
                toggleMute(true);
              }
            }}
            className="w-20 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0"
            style={{
              background: `linear-gradient(to right, rgb(16 185 129) 0%, rgb(16 185 129) ${volume}%, rgb(51 65 85) ${volume}%, rgb(51 65 85) 100%)`,
            }}
            aria-label="Volume"
          />

          {/* Botão de Skip (admin) */}
          <AdminSkipButton />
        </div>
      </div>
    </div>
  );
}
