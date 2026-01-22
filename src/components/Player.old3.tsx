"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/context/AudioContext";
import { socket } from "@/lib/socket";
import type { PlayerData } from "@/types";

interface IcecastPlayerProps {
  streamUrl?: string;
  coverImage?: string;
  className?: string;
}

const DEFAULT_TITLE = "Rádio Som do Mato";

export default function IcecastPlayer({
  streamUrl = "https://radio.somdomato.com/geral.mp3",
  coverImage = "/images/logotipo.svg",
  className = "",
}: IcecastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    play,
    pause,
    playing,
    volume,
    setVolume,
    muted,
    toggleMute,
    title,
    artist,
  } = useAudio();
  const [_song, setSong] = useState<PlayerData | null>({
    id: 0,
    title: "Rádio Som do Mato",
    artist: "A mais sertaneja",
  });
  const [_cover, setCover] = useState("/images/logotipo.svg");
  const [isLoading, setIsLoading] = useState(false);

  // Atualiza o volume do áudio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume / 100;
    }
  }, [volume, muted]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      pause();
    } else {
      setIsLoading(true);
      audioRef.current.play().catch((error) => {
        console.error("Playback failed:", error);
        setIsLoading(false);
      });
    }
  };

  const handleReload = () => {
    if (!audioRef.current) return;

    const wasPlaying = playing;
    audioRef.current.load();

    if (wasPlaying) {
      setIsLoading(true);
      audioRef.current.play().catch((error) => {
        console.error("Reload playback failed:", error);
        setIsLoading(false);
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && muted) {
      toggleMute(false);
    }
  };

  useEffect(() => {
    socket.on("song:changed", onSongChanged);

    async function onSongChanged(nextSong: {
      id: number;
      title: string;
      artist: string;
      cover?: string;
    }) {
      if (typeof window !== "undefined") {
        const storedCover = localStorage.getItem("cover");
        if (storedCover) setCover(storedCover);
        if (nextSong.cover) localStorage.setItem("cover", nextSong.cover);
      }

      const request = await fetch("https://radio.somdomato.com/json");

      if (request.ok) {
        const {
          icestats: { source },
        } = await request.json();
        let iceArtist = source.artist;
        let iceTitle = source.title;

        // Se não houver artist, tenta separar pelo padrão "Artista - Música"
        if (!iceArtist && iceTitle) {
          const parts = iceTitle.split(" - ");
          if (parts.length > 1) {
            iceArtist = parts[0].trim();
            iceTitle = parts.slice(1).join(" - ").trim();
          }
        }

        const artist = iceArtist === "Unknown" ? DEFAULT_TITLE : iceArtist;
        const title = iceTitle === "Unknown" ? DEFAULT_TITLE : iceTitle;

        setSong({ title, artist });

        // Usar a capa salva no localStorage
        const nextCover = localStorage.getItem("cover");
        setCover(nextCover || "/images/logotipo.svg");
        localStorage.removeItem("cover");

        //if (title !== DEFAULT_TITLE && artist !== DEFAULT_TITLE) {
        //toast.success(`Tocando agora: ${title} - ${artist}`, { duration: 5000 });
        //}
      }
    }

    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <div
      className={`flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg px-3 py-1.5 shadow-lg border-2 border-black/50 ${className}`}
    >
      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="none"
        onPlaying={() => {
          play();
          setIsLoading(false);
        }}
        onPause={() => play()}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {/* Cover Image */}
      <div className="relative flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden shadow-md">
        <Image
          src={coverImage}
          alt="Cover"
          className="w-full h-full object-cover"
          fill
        />
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <div className="text-sm font-semibold text-white truncate">{title}</div>
        <div className="text-xs text-slate-400 truncate">{artist}</div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="w-4 h-4" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* Reload Button */}
        <button
          onClick={handleReload}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-all active:scale-95"
          aria-label="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Volume Controls - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 ml-1">
          <button
            onClick={() => toggleMute(!muted)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-all active:scale-95"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume Slider */}
          <div className="relative w-20 h-1 bg-slate-700 rounded-full overflow-hidden group">
            <div
              className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
              style={{ width: `${muted ? 0 : volume}%` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
