"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { buildStreamUrl, DEFAULT_SONG, DEFAULT_GENRE } from "@/config";

interface AudioContextType {
  title: string;
  artist: string;
  cover: string;
  setSong: (song: { title: string; artist: string; cover: string }) => void;
  playing: boolean;
  play: (streamUrl?: string) => Promise<void>;
  pause: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  toggleMute: (muted?: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSource, setCurrentSource] = useState(
    buildStreamUrl(DEFAULT_GENRE)
  );
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState<string>(DEFAULT_SONG.title);
  const [artist, setArtist] = useState<string>(DEFAULT_SONG.artist);
  const [cover, setCover] = useState<string>(DEFAULT_SONG.cover);

  const setSong = (song: { title: string; artist: string; cover: string }) => {
    setTitle(song.title);
    setArtist(song.artist);
    setCover(song.cover);
  };

  const play = async (streamUrl?: string) => {
    if (!audioRef.current) return;

    try {
      const source = streamUrl || currentSource;
      const srcWithTs = `${source}?t=${Date.now()}`;

      // Pausar antes de trocar source
      audioRef.current.pause();
      audioRef.current.src = srcWithTs;
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = muted;

      await audioRef.current.play();
      setPlaying(true);

      // Atualizar fonte atual se trocar explicitamente
      if (streamUrl) {
        setCurrentSource(streamUrl);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Erro ao reproduzir áudio:", error);
      setPlaying(false);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (force?: boolean) => {
    const next = typeof force === "boolean" ? force : !muted;
    setMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const setVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolumeState(clamped);
  };

  // Sincronizar volume com elemento de áudio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  return (
    <AudioContext.Provider
      value={{
        play,
        pause,
        playing,
        volume,
        setVolume,
        toggleMute,
        muted,
        title,
        artist,
        cover,
        setSong,
      }}
    >
      {children}
      <audio ref={audioRef} />
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
