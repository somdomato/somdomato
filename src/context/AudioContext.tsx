"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { buildStreamUrl, DEFAULT_MOUNTPOINT } from "@/lib/radio";

interface AudioContextType {
  title: string;
  artist: string;
  cover: string;
  setTitle: (title: string) => void;
  setArtist: (artist: string) => void;
  setCover: (cover: string) => void;
  playing: boolean;
  play: (streamUrl?: string) => void;
  pause: () => void;
  // volume is 0-100 in the app
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  // optionally accept a value to force mute/unmute
  toggleMute: (muted?: boolean) => void;
  // preview mode state
  previewActive: boolean;
  setPreviewActive: (active: boolean) => void;
  // register an event listener on the internal audio element; returns an unsubscribe function
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const defaultSource = buildStreamUrl(
    DEFAULT_MOUNTPOINT,
    process.env.NEXT_PUBLIC_RADIO_SOURCE,
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSource, setCurrentSource] = useState(defaultSource);
  // store volume as 0-100 to match UI controls
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState("Rádio Som do Mato");
  const [artist, setArtist] = useState("A mais sertaneja");
  const [cover, setCover] = useState("/images/logotipo.svg");
  const [previewActive, setPreviewActive] = useState(false);

  const play = async (streamUrl?: string) => {
    if (audioRef.current) {
      const source = streamUrl || currentSource;
      if (streamUrl) {
        setCurrentSource(streamUrl);
        // Pausar stream anterior antes de trocar
        audioRef.current.pause();
      }
      audioRef.current.src = `${source}?t=${Date.now() / 1000}`;
      audioRef.current.load(); // Forçar carregamento do novo src
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (error) {
        // Ignorar DOMException ao abortar stream (comportamento esperado ao trocar gêneros)
        if (error instanceof DOMException && error.name === "AbortError") {
          // Silenciosamente ignorar - comportamento normal
          return;
        }
        console.error("Error playing audio:", error);
        setPlaying(false);
      }
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  function toggleMute(force?: boolean) {
    const next = typeof force === "boolean" ? force : !muted;
    setMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  }

  const setVolume = (v: number) => {
    // clamp to 0-100
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolumeState(clamped);
  };

  // Sync volume and muted state to audio element
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
        setTitle,
        setArtist,
        previewActive,
        setPreviewActive,
        setCover,
      }}
    >
      {children}
      <audio ref={audioRef} src={currentSource} />
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
