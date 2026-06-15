"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { buildStreamUrl, DEFAULT_SONG, DEFAULT_GENRE } from "@/config";

interface AudioContextType {
  title: string;
  artist: string;
  cover: string;
  songId: number | null;
  setSong: (song: {
    id?: number;
    title: string;
    artist: string;
    cover: string;
  }) => void;
  updateCover: (cover: string) => void;
  playing: boolean;
  loading: boolean;
  play: (streamUrl?: string) => Promise<void>;
  pause: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  toggleMute: (muted?: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

// Monta a artwork do MediaSession a partir da capa atual, com fallback
// para o logo da rádio quando a capa não foi encontrada.
const buildArtwork = (cover: string): MediaImage[] => {
  if (!cover || cover === DEFAULT_SONG.cover) {
    return [{ src: "/images/ogp.png", sizes: "256x256", type: "image/png" }];
  }

  const ext = cover.split(".").pop()?.toLowerCase();
  const type =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  return [
    { src: cover, sizes: "96x96", type },
    { src: cover, sizes: "256x256", type },
    { src: cover, sizes: "512x512", type },
  ];
};

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSource, setCurrentSource] = useState(
    buildStreamUrl(DEFAULT_GENRE),
  );
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);
  const [title, setTitle] = useState<string>(DEFAULT_SONG.title);
  const [artist, setArtist] = useState<string>(DEFAULT_SONG.artist);
  const [cover, setCover] = useState<string>(DEFAULT_SONG.cover);
  const [songId, setSongId] = useState<number | null>(null);

  const setSong = (song: {
    id?: number;
    title: string;
    artist: string;
    cover: string;
  }) => {
    const { title, artist, cover, id } = song;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: "Rádio Som do Mato",
        artwork: buildArtwork(cover),
      });
    }

    setTitle(title);
    setArtist(artist);
    setCover(cover);
    if (id != null) setSongId(id);
  };

  const updateCover = (newCover: string) => {
    setCover(newCover);

    if ("mediaSession" in navigator && navigator.mediaSession.metadata) {
      const current = navigator.mediaSession.metadata;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: current.album,
        artwork: buildArtwork(newCover),
      });
    }
  };

  const play = useCallback(
    async (streamUrl?: string) => {
      if (!audioRef.current) return;

      // Immediately set playing state for instant UI feedback
      setPlaying(true);
      setLoading(true);

      try {
        const source = streamUrl || currentSource;
        const srcWithTs = `${source}?t=${Date.now()}`;

        // Pausar antes de trocar source
        audioRef.current.pause();
        audioRef.current.src = srcWithTs;
        audioRef.current.volume = volume / 100;
        audioRef.current.muted = muted;

        await audioRef.current.play();
        // Loading will be set to false when canplaythrough fires

        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }

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
        setLoading(false);
      }
    },
    [currentSource, volume, muted],
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      setLoading(false);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    }
  }, []);

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

  // Permitir controlar play/pause pela tela de bloqueio / notificação do sistema
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      pause();
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [play, pause]);

  // Handle audio events for loading state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleCanPlayThrough = () => {
      setLoading(false);
    };

    const handleWaiting = () => {
      if (playing) setLoading(true);
    };

    const handlePlaying = () => {
      setLoading(false);
    };

    const handleError = () => {
      setLoading(false);
    };

    const handleStalled = () => {
      setLoading(false);
    };

    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("error", handleError);
    audio.addEventListener("stalled", handleStalled);

    return () => {
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("stalled", handleStalled);
    };
  }, [playing]);

  return (
    <AudioContext.Provider
      value={{
        play,
        pause,
        playing,
        loading,
        volume,
        setVolume,
        toggleMute,
        muted,
        title,
        artist,
        cover,
        songId,
        setSong,
        updateCover,
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
