"use client";

import Image from "next/image";
import { useEffect } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/context/AudioContext";
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
      if (!res.ok) throw new Error("Falha ao enviar skip");
      toast.success("Skip enviado");
    } catch (err) {
      toast.error("Erro ao enviar skip");
      console.error(err);
    }
  }, [isAuthenticated, password]);

  if (!isAuthenticated) return null;

  return (
    <button onClick={handle} title="Skip (admin)" className="w-8 h-8 flex items-center justify-center rounded-full bg-yellow-500 text-black hover:opacity-90 transition">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v16l12-8z"></path><line x1="6" y1="4" x2="6" y2="20"></line></svg>
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
  const { playing, play, pause, volume, setVolume, muted, toggleMute, title, artist, cover, setTitle, setArtist, setCover } = useAudio();

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

          if (finalTitle !== DEFAULT_TITLE && finalArtist !== DEFAULT_TITLE) {
            toast.success(`Tocando agora: ${finalTitle} - ${finalArtist}`, { duration: 5000 });
          }

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
            toast.success(`Tocando agora: ${parsedData.title} - ${parsedData.artist}`, { duration: 5000 });
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
    <div className={`flex items-center gap-3 bg-gradient-to-r from-background-alt to-[#2c3b26] rounded-lg px-3 py-1.5 shadow-lg border-2 border-black/50 ${className}`}>
      {/* Cover Image */}
      <div className="relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden shadow-md">
        <Image src={cover} alt="Cover" className="w-full h-full object-cover" fill />
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <div className="text-sm font-semibold text-white truncate" title={title}>
          {title}
        </div>
        <div className="text-xs text-slate-400 truncate" title={artist}>
          {artist}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Play/Pause */}
        <button
          onClick={() => (playing ? pause() : play())}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
        </button>

        {/* Reload */}
        <button
          onClick={() => {
            if (playing) {
              pause();
              setTimeout(() => play(), 100);
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
