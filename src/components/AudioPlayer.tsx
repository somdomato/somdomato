"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { Pause, Play, VolumeX, Volume2 } from "lucide-react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import type { PlayerData } from "@/types/song";

export default function AudioPlayer() {
  const { play, pause, playing, volume, setVolume, muted, setMuted } =  useAudio();
  const [song, setSong] = useState<PlayerData | null>({
    title: "Rádio Som do Mato",
    artist: "",
  });
  const [cover, setCover] = useState("/images/logotipo.svg");

  function truncate(text: string, max: number) {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) setMuted(true);
    else if (muted) setMuted(false);
  };

  useEffect(() => {
    socket.on("song:changed", onSongChanged);

    async function onSongChanged(nextSong: {
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
        let artist = source.artist;
        let title = source.title;

        // Se não houver artist, tenta separar pelo padrão "Artista - Música"
        if (!artist && title) {
          const parts = title.split(" - ");
          if (parts.length > 1) {
            artist = parts[0].trim();
            title = parts.slice(1).join(" - ").trim();
          }
        }

        setSong({ title, artist });

        // Usar a capa salva no localStorage
        const nextCover = localStorage.getItem("cover");
        setCover(nextCover || "/images/logotipo.svg");
        localStorage.removeItem("cover");

        toast.success(`Tocando agora: ${title} - ${artist}`, {
          duration: 5000,
        });
      }
    }

    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <div className="w-full bg-background text-white p-2 flex items-center justify-between gap-2">
      <div>
        <Image
          src={cover}
          alt="Capa do álbum"
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover animate-[spin_5s_linear_infinite]"
        />
      </div>
      <div>
        <h2 className="font-semibold -mb-1">
          {truncate(song?.title || "Rádio Som do Mato", 32)}
        </h2>
        <p className="text-sm">
          {truncate(song?.artist || "A mais sertaneja", 32)}
        </p>
      </div>

      {/* Controles de Volume */}
      <div className="flex items-center gap-1 shrink-0 mr-1">
        {/* Botão Mute/Unmute */}
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 hover:bg-black/20 text-gray-300 transition-colors duration-200 cursor-pointer"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted || volume === 0 ? (
            <VolumeX size={14} />
          ) : (
            <Volume2 size={14} />
          )}
        </button>

        {/* Slider de Volume */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : Number(volume)}
          onChange={handleVolumeChange}
          className="w-16 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer slider shadow-sm"
          style={{
            background: `linear-gradient(to right, #16a34a 0%, #16a34a ${(muted ? 0 : Number(volume)) * 100}%, #4b5563 ${(muted ? 0 : Number(volume)) * 100}%, #4b5563 100%)`,
            boxShadow: `0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(22, 163, 74, ${(muted ? 0 : Number(volume)) * 0.5})`,
          }}
          aria-label="Controle de volume"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-black/50 hover:bg-green-700 text-white transition-colors duration-200 disabled:opacity-50 cursor-pointer"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
