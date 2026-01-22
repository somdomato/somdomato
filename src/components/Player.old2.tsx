"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCw, Volume2, VolumeX } from "lucide-react";

interface IcecastPlayerProps {
  streamUrl?: string;
  coverImage?: string;
  defaultTitle?: string;
  defaultArtist?: string;
  className?: string;
}

export default function IcecastPlayer({
  streamUrl = "https://radio.somdomato.com/geral.mp3",
  coverImage = "/images/logotipo.svg",
  defaultTitle = "Ao Vivo",
  defaultArtist = "Rádio",
  className = "",
}: IcecastPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({
    title: defaultTitle,
    artist: defaultArtist,
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  // Atualiza o volume do áudio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Tentativa de buscar metadados do Icecast (simplificado)
  useEffect(() => {
    if (!isPlaying) return;

    const fetchMetadata = async () => {
      try {
        // Exemplo de endpoint - ajuste conforme seu servidor Icecast
        const statusUrl = streamUrl.replace(/\/stream$/, "/status-json.xsl");
        const response = await fetch(statusUrl);
        const data = await response.json();

        // Ajuste conforme estrutura do seu Icecast
        if (data?.icestats?.source) {
          const source = Array.isArray(data.icestats.source)
            ? data.icestats.source[0]
            : data.icestats.source;

          if (source.title) {
            const [artist, title] = source.title.split(" - ");
            setMetadata({
              artist: artist || defaultArtist,
              title: title || source.title || defaultTitle,
            });
          }
        }
      } catch (error) {
        // Silenciosamente ignora erros de metadata
        console.debug("Metadata fetch failed:", error);
      }
    };

    fetchMetadata();
    const interval = setInterval(fetchMetadata, 10000); // Atualiza a cada 10s

    return () => clearInterval(interval);
  }, [isPlaying, streamUrl, defaultTitle, defaultArtist]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
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

    const wasPlaying = isPlaying;
    audioRef.current.load();

    if (wasPlaying) {
      setIsLoading(true);
      audioRef.current.play().catch((error) => {
        console.error("Reload playback failed:", error);
        setIsLoading(false);
      });
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

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
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
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
        <div className="text-sm font-semibold text-white truncate">
          {metadata.title}
        </div>
        <div className="text-xs text-slate-400 truncate">{metadata.artist}</div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
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
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-all active:scale-95"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume Slider */}
          <div className="relative w-20 h-1 bg-slate-700 rounded-full overflow-hidden group">
            <div
              className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
              style={{ width: `${isMuted ? 0 : volume}%` }}
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
