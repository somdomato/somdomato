"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { Pause, Play, VolumeX, Volume2 } from "lucide-react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import type { PlayerData } from "@/types/song";

export function ButtonGroup1() {
  return (
    <section className="pb-10 pt-20 lg:pb-20 lg:pt-[120px] ">
      <div className="container">
        <div className="flex justify-center">
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-stroke ">
            <button className="border-r border-stroke px-4 py-3 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary ">
              Button Text
            </button>
            <button className="border-r border-stroke px-4 py-3 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary ">
              Button Text
            </button>
            <button className="border-r border-stroke px-4 py-3 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary ">
              Button Text
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AudioPlayer() {
  const { play, pause, playing, volume, setVolume, muted, setMuted } =
    useAudio();
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
        <div className="container">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-black/50">
              <button
                type="button"
                onClick={() => (playing ? pause() : play())}
                className="border-r border-black/50 px-3 py-2 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary cursor-pointer"
                aria-label={playing ? "Pausar" : "Reproduzir"}
              >
                {playing ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMuted(!muted)}
                className="border-r border-black/50 px-3 py-2 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary cursor-pointer"
                aria-label={muted ? "Ativar som" : "Silenciar"}
              >
                {muted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <button className="border-r border-black/50 px-3 py-2 text-base font-medium text-dark last-of-type:border-r-0 hover:bg-gray-2 hover:text-primary cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : Number(volume)}
                  onChange={handleVolumeChange}
                  className="mb-2 w-16 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer slider shadow-sm"
                  style={{
                    background: `linear-gradient(to right, #16a34a 0%, #16a34a ${(muted ? 0 : Number(volume)) * 100}%, #4b5563 ${(muted ? 0 : Number(volume)) * 100}%, #4b5563 100%)`,
                    boxShadow: `0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(22, 163, 74, ${(muted ? 0 : Number(volume)) * 0.5})`,
                  }}
                  aria-label="Controle de volume"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
