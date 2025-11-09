"use client";

import { createContext, useContext, useRef, useState } from "react";

interface AudioContextType {
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  currentTrack: string;
  play: (src: string) => void;
  reload: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  currentSource: string;
  setCurrentSource: (src: string) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState("");
  const [currentSource, setCurrentSource] = useState("https://radio.somdomato.com/radio.mp3");
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);

  const reload = () => {
    if (audioRef.current) {
      setCurrentSource(currentSource);
      audioRef.current.src = currentSource;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const play = (src: string) => {
    if (audioRef.current) {
      setCurrentTrack(src);
      audioRef.current.src = src;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const setVolume = (volume: number) => {
    setVolumeState(volume);
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (volume === 0) {
        setMuted(true);
      } else if (muted) {
        setMuted(false);
      }
    }
  };

  return (
    <AudioContext.Provider value={{ currentSource, setCurrentSource, isPlaying, currentTrack, play, pause, reload, volume, setVolume, muted, setMuted }}>
      {children}
      <audio ref={audioRef} muted={muted} />
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