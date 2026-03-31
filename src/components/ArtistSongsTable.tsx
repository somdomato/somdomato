"use client";

import React from "react";
import Image from "next/image";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { requestSong } from "@/actions/requests";
import { useAudio } from "@/context/AudioContext";
import { toast } from "sonner";

interface Song {
  id: number;
  title: string;
  artist: string;
  cover?: string | null;
}

// ─── Mini Player ────────────────────────────────────────────────────────────

function MiniPlayer({ song, onStop }: { song: Song; onStop: () => void }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [volume, setVolume] = React.useState(() => {
    if (typeof window === "undefined") return 80;
    const saved = localStorage.getItem("preview-volume");
    return saved ? Number(saved) : 80;
  });
  const [muted, setMuted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const seekRef = React.useRef<HTMLInputElement>(null);
  const onStopRef = React.useRef(onStop);
  onStopRef.current = onStop;
  const volumeRef = React.useRef(volume);
  volumeRef.current = volume;

  // Create audio element on mount
  React.useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = volumeRef.current / 100;
    audioRef.current = audio;

    const url = `/api/music/file/${song.id}`;
    audio.src = url;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      onStopRef.current();
    };
    const onError = () => {
      toast.error("Erro ao carregar música");
      onStopRef.current();
    };
    const onCanPlay = () => setLoading(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    // Autoplay
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {});

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
      audio.src = "";
    };
  }, [song.id]);

  // Sync volume
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    localStorage.setItem("preview-volume", String(val));
    if (val > 0 && muted) setMuted(false);
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const seekPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volPercent = volume;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Song info + play/pause */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={loading}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary text-background transition hover:bg-primary/80 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{song.title}</p>
          <p className="text-xs text-white/40 truncate">{song.artist}</p>
        </div>

        {/* Volume controls */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="text-white/40 hover:text-white transition"
          >
            {muted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="w-20 h-1 accent-primary"
            style={
              { "--value": `${muted ? 0 : volPercent}%` } as React.CSSProperties
            }
          />
        </div>

        {/* Mobile mute */}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="sm:hidden text-white/40 hover:text-white transition"
        >
          {muted || volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-2 text-[11px] text-white/40">
        <span className="w-8 text-right tabular-nums">{fmt(currentTime)}</span>
        <input
          ref={seekRef}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 accent-primary"
          style={{ "--value": `${seekPercent}%` } as React.CSSProperties}
        />
        <span className="w-8 tabular-nums">{fmt(duration)}</span>
      </div>
    </div>
  );
}

// ─── Songs Table ────────────────────────────────────────────────────────────

export default function ArtistSongsTable({ artist }: { artist: string }) {
  const [songs, setSongs] = React.useState<Song[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [requestingId, setRequestingId] = React.useState<number | null>(null);
  const [playingSong, setPlayingSong] = React.useState<Song | null>(null);

  const radio = useAudio();
  const radioWasPlayingRef = React.useRef(false);
  const radioWasMutedRef = React.useRef(false);
  const radioToggleMuteRef = React.useRef(radio.toggleMute);
  radioToggleMuteRef.current = radio.toggleMute;

  React.useEffect(() => {
    if (artist === null || artist === undefined) return;
    setLoading(true);
    setPlayingSong(null);
    const fetchArtist = artist === "" ? "__EMPTY_ARTIST__" : artist;
    fetch(`/api/artists/${encodeURIComponent(fetchArtist)}/songs`)
      .then((r) => r.json())
      .then((data) => setSongs(data.songs || []))
      .finally(() => setLoading(false));
  }, [artist]);

  // Restore radio on unmount
  React.useEffect(() => {
    return () => {
      if (radioWasPlayingRef.current && !radioWasMutedRef.current) {
        radioToggleMuteRef.current(false);
      }
    };
  }, []);

  const handlePlay = (song: Song) => {
    if (playingSong?.id === song.id) {
      // Toggle off → restore radio
      setPlayingSong(null);
      if (!radioWasMutedRef.current) {
        radio.toggleMute(false);
      }
      return;
    }

    // Mute radio if it's playing and not already muted
    if (radio.playing && !radio.muted) {
      radioWasPlayingRef.current = true;
      radioWasMutedRef.current = false;
      radio.toggleMute(true);
    } else {
      radioWasPlayingRef.current = radio.playing;
      radioWasMutedRef.current = radio.muted;
    }

    setPlayingSong(song);
  };

  const handleStop = () => {
    setPlayingSong(null);
    if (radioWasPlayingRef.current && !radioWasMutedRef.current) {
      radio.toggleMute(false);
    }
  };

  const handleRequest = async (song: Song) => {
    setRequestingId(song.id);
    try {
      const result = await requestSong(song.id);
      if (result.success) {
        toast.success(`"${song.title}" adicionada à fila`);
      } else {
        toast.error(result.message || "Não foi possível pedir esta música");
      }
    } catch {
      toast.error("Erro ao pedir música");
    } finally {
      setRequestingId(null);
    }
  };

  if (artist === null || artist === undefined) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {["s1", "s2", "s3", "s4", "s5"].map((id) => (
          <div
            key={id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse"
          >
            <div className="w-12 h-12 rounded-lg bg-white/10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/40">
        <Music className="w-8 h-8 mb-2" />
        <p className="text-sm">Nenhuma música encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Mini player (sticky on scroll) */}
      {playingSong && (
        <div className="sticky top-0 z-10 pb-2">
          <MiniPlayer
            key={playingSong.id}
            song={playingSong}
            onStop={handleStop}
          />
        </div>
      )}

      {songs.map((s) => {
        const isActive = playingSong?.id === s.id;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-2 p-2.5 rounded-xl transition group ${isActive ? "bg-primary/10" : "hover:bg-white/5"}`}
          >
            {/* Play overlay on cover */}
            <button
              type="button"
              onClick={() => handlePlay(s)}
              className="w-12 h-12 relative rounded-lg overflow-hidden shrink-0 group/cover"
            >
              <Image
                src={s.cover || "/images/logotipo.svg"}
                alt={s.title}
                fill
                sizes="48px"
                className="object-cover"
              />
              <div
                className={`absolute inset-0 flex items-center justify-center bg-black/40 transition ${isActive ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100"}`}
              >
                {isActive ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </div>
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.title}</p>
              <p className="text-xs text-white/40 truncate">{s.artist}</p>
            </div>

            <button
              type="button"
              onClick={() => handleRequest(s)}
              disabled={requestingId === s.id}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestingId === s.id ? "..." : "Pedir"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
