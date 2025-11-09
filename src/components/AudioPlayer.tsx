"use client";

import { useEffect, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { Pause, Play, VolumeX, Volume2 } from "lucide-react";
import { socket } from "@/lib/socket";
import type { Song } from "@/types/song";

export default function AudioPlayer() {
  const { play, pause, playing, volume, setVolume, muted, setMuted } = useAudio();
  const [song, setSong] = useState<Song | null>({
    title: "Rádio Som do Mato",
    artist: "",
    id: 0,
    path: "",
  });

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

    function onSongChanged(song: Song) {
      setSong(song);
    }

    return () => {
      socket.off("song:changed", onSongChanged);
    };
  }, []);

  return (
    <div className="w-full bg-background text-white p-2 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{truncate(song?.artist || "Rádio Som do Mato", 32)}</h2>
        <p className="text-sm">{truncate(song?.title || "A mais sertaneja", 32)}</p>
      </div>

      {/* Controles de Volume */}
      <div className="flex items-center gap-1 flex-shrink-0 mr-1">
        {/* Botão Mute/Unmute */}
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className="flex items-center justify-center w-6 h-6 rounded-full bg-black/40 hover:bg-black/20 text-gray-300 transition-colors duration-200 cursor-pointer"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted || volume === 0 ? (
            <VolumeX size={12} />
          ) : (
            <Volume2 size={12} />
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
          className="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors duration-200 disabled:opacity-50 cursor-pointer"
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
