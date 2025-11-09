"use client";

import { useEffect, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { Pause, Play } from "lucide-react";
import { socket } from "@/lib/socket";
import type { Song } from "@/types/song";

export default function AudioPlayer() {
  const { play, pause, playing } = useAudio();
  const [song, setSong] = useState<Song | null>({
    title: "Rádio Som do Mato",
    artist: "",
    id: 0,
    path: "",
  });

  function truncate(text: string, max: number) {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  useEffect(() => {
    // if (socket.connected) {
    // }
    socket.on("song:changed", onSongChanged);

    function onSongChanged(song: Song) {
      setSong(song);
    }

    return () => {
      socket.off("song:changed");
    };
  }, []);

  return (
    <div className="w-full bg-gray-800 text-white p-2 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{truncate(song?.artist || "Rádio Som do Mato", 32)}</h2>
        <p className="text-sm">{truncate(song?.title || "A mais sertaneja", 32)}</p>
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
