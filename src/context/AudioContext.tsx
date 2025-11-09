"use client";

import { createContext, useContext, useRef, useState } from "react";

interface AudioContextType {
  playing: boolean;
  play: () => void;
  pause: () => void;
}

// interface AudioContextType {
//   isPlaying: boolean;
//   volume: number;
//   muted: boolean;
//   currentTrack: string;
//   play: (src: string) => void;
//   reload: () => void;
//   pause: () => void;
//   setVolume: (volume: number) => void;
//   setMuted: (muted: boolean) => void;
//   currentSource: string;
//   setCurrentSource: (src: string) => void;
// }

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const source = "https://radio.somdomato.com/radio.mp3";
  const [playing, setPlaying] = useState(false);

  // const [currentTrack, setCurrentTrack] = useState("");
  // const [currentSource, setCurrentSource] = useState("https://radio.somdomato.com/radio.mp3");
  // const [volume, setVolumeState] = useState(1);
  // const [muted, setMuted] = useState(false);

  // const reload = () => {
  //   if (audioRef.current) {
  //     setCurrentSource(currentSource);
  //     audioRef.current.src = currentSource;
  //     audioRef.current.play();
  //     setIsPlaying(true);
  //   }
  // };

  const play = () => {
    if (audioRef.current) {
      audioRef.current.src = `${source}?t=${Date.now()/1000}`;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      audioRef.current.src = `${source}?t=${Date.now()/1000}`;
    }
  };

  return (
    <AudioContext.Provider value={{ play, pause, playing }}>
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