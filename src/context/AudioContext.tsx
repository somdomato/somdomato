"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

interface AudioContextType {
  title: string;
  artist: string;
  cover: string;
  setTitle: (title: string) => void;
  setArtist: (artist: string) => void;
  setCover: (cover: string) => void;
  playing: boolean;
  play: () => void;
  pause: () => void;
  // volume is 0-100 in the app
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  // optionally accept a value to force mute/unmute
  toggleMute: (muted?: boolean) => void;
  // register an event listener on the internal audio element; returns an unsubscribe function
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const source = process.env.NEXT_PUBLIC_RADIO_SOURCE || "https://radio.somdomato.com/geral.mp3";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  // store volume as 0-100 to match UI controls
  const [volume, setVolumeState] = useState(70);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cover, setCover] = useState("/images/logotipo.svg");

  const play = () => {
    if (audioRef.current) {
      audioRef.current.src = `${source}?t=${Date.now() / 1000}`;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      audioRef.current.src = `${source}?t=${Date.now() / 1000}`;
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
        setCover,
      }}
    >
      {children}
      <audio ref={audioRef} src={source} />
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
