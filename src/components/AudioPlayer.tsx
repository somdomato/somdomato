"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { Pause, Play, VolumeX, Volume2, Heart } from "lucide-react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import type { PlayerData } from "@/types/song";

const DEFAULT_TITLE = "Rádio Som do Mato";

export default function AudioPlayer() {
  const { play, pause, playing, volume, setVolume, muted, toggleMute } =
    useAudio();
  const [song, setSong] = useState<PlayerData | null>({
    id: 0,
    title: "Rádio Som do Mato",
    artist: "",
  });
  const [cover, setCover] = useState("/images/logotipo.svg");
  const [liked, setLiked] = useState(false);

  async function likeSong(id: number | undefined) {
    if (!id || id === 0) return;
    try {
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: id }),
      }).then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setLiked(true);
          toast.success("Obrigado pelo like!");
        }
      });
    } catch (err) {
      console.error("Error liking song:", err);
    }
  }

  function truncate(text: string, max: number) {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) toggleMute(true);
    else if (muted) toggleMute(false);
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

        if (title !== DEFAULT_TITLE && artist !== DEFAULT_TITLE) {
          toast.success(`Tocando agora: ${title} - ${artist}`, {
            duration: 5000,
          });
        }
      }
    }

    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <div className="w-full bg-background text-white p-2 flex items-center justify-between gap-2">
      <div className="hidden md:block shrink-0">
        <Image
          src={cover}
          alt="Capa do álbum"
          width={40}
          height={40}
          className="w-10 h-10 rounded-full object-cover animate-[spin_5s_linear_infinite]"
        />
      </div>
      <div className="hidden md:block flex-1 min-w-0">
        <h2 className="text-sm font-semibold -mb-0.5 truncate">
          {truncate(song?.title || "Rádio Som do Mato", 32)}
        </h2>
        <p className="text-xs truncate">
          {truncate(song?.artist || "A mais sertaneja", 32)}
        </p>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1 shrink-0 mr-1">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-black/50">
            <button
              type="button"
              onClick={() => (playing ? pause() : play())}
              className="border-r border-black/50 px-3 py-2 text-base font-medium text-dark hover:bg-gray-2 hover:text-primary cursor-pointer"
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              onClick={() => likeSong(song?.id)}
              className="border-r border-black/50 px-3 py-2 text-base font-medium text-dark hover:bg-gray-2 hover:text-primary cursor-pointer"
            >
              <Heart size={18} className={liked ? "text-red-500" : ""} />
            </button>
            <div className="border-r border-black/50 last-of-type:border-r-0 px-3 py-2 text-base font-medium text-dark hover:text-primary cursor-pointer flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleMute(!muted)}
                className="md:mr-2 cursor-pointer"
                aria-label={muted ? "Ativar som" : "Silenciar"}
              >
                {muted || volume === 0 ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <button className="hidden md:block -mt-1 cursor-pointer">
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
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
