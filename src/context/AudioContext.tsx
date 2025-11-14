"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

interface AudioContextType {
  playing: boolean;
  play: () => void;
  pause: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  toggleMute: (muted: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const source = "https://radio.somdomato.com/radio.mp3";
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

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

  function toggleMute() {
    setMuted(!muted);
    if (audioRef.current) {
      audioRef.current.muted = !muted;
    }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <AudioContext.Provider
      value={{ play, pause, playing, volume, setVolume, toggleMute, muted }}
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
