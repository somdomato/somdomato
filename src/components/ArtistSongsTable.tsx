"use client";

import React from "react";
import Image from "next/image";
import { useAudio } from "@/context/AudioContext";
import { toast } from "sonner";

interface Song {
  id: number;
  title: string;
  artist: string;
  cover?: string | null;
  path?: string;
}

export default function ArtistSongsTable({ artist }: { artist: string }) {
  const [songs, setSongs] = React.useState<Song[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const audioCtx = useAudio();
  const previewRef = React.useRef<HTMLAudioElement | null>(null);
  const [previewSongId, setPreviewSongId] = React.useState<number | null>(null);
  
  // Store radio state before preview starts
  const savedStateRef = React.useRef<{
    wasPlaying: boolean;
    volume: number;
    wasMuted: boolean;
  } | null>(null);

  React.useEffect(() => {
    // artist may be empty string (meaning "Sem artista"). Only bail out on null/undefined.
    if (artist === null || artist === undefined) return;
    setLoading(true);
    const fetchArtist = artist === "" ? "__EMPTY_ARTIST__" : artist;
    fetch(`/api/artists/${encodeURIComponent(fetchArtist)}/songs`)
      .then((r) => r.json())
      .then((data) => setSongs(data.songs || []))
      .finally(() => setLoading(false));
  }, [artist]);

  // Sync preview volume with global volume control
  React.useEffect(() => {
    if (previewRef.current && !previewRef.current.paused) {
      previewRef.current.volume = audioCtx.volume / 100;
    }
  }, [audioCtx.volume]);

  // Cleanup preview on unmount
  React.useEffect(() => {
    return () => {
      if (previewRef.current) {
        try {
          previewRef.current.pause();
          previewRef.current.src = "";
          previewRef.current.remove();
        } catch (e) {
          console.warn("Error cleaning up preview:", e);
        }
        previewRef.current = null;
      }
      // Restore radio if component unmounts while preview is active
      if (savedStateRef.current) {
        audioCtx.setPreviewActive(false);
        if (savedStateRef.current.wasPlaying) {
          audioCtx.play();
        }
        if (!savedStateRef.current.wasMuted) {
          audioCtx.toggleMute(false);
        }
        savedStateRef.current = null;
      }
    };
  }, [audioCtx]);

  // Stop preview and restore radio state
  const stopPreviewAndRestoreRadio = React.useCallback(() => {
    // Stop and cleanup preview audio
    if (previewRef.current) {
      try {
        const audio = previewRef.current;
        previewRef.current = null; // Clear ref first to prevent re-entry
        
        // Remove event listeners before cleanup
        audio.removeEventListener("ended", stopPreviewAndRestoreRadio);
        audio.pause();
        audio.src = "";
        audio.load();
        audio.remove();
      } catch (e) {
        console.warn("Error cleaning up preview:", e);
      }
    }
    
    setPreviewSongId(null);
    audioCtx.setPreviewActive(false);

    // Restore radio state
    if (savedStateRef.current) {
      const { wasPlaying, wasMuted } = savedStateRef.current;
      
      savedStateRef.current = null;
      
      // Restore mute state first
      if (!wasMuted && audioCtx.muted) {
        audioCtx.toggleMute(false);
      }
      
      // Resume playing if it was playing before
      if (wasPlaying && !audioCtx.playing) {
        setTimeout(() => audioCtx.play(), 100);
      }
    }
  }, [audioCtx]);

  const handlePlayPreview = async (song: Song) => {
    // If same song is playing, stop it
    if (previewSongId === song.id && previewRef.current) {
      stopPreviewAndRestoreRadio();
      return;
    }

    // If another preview is playing, stop it first
    if (previewRef.current) {
      stopPreviewAndRestoreRadio();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Save current radio state
    savedStateRef.current = {
      wasPlaying: audioCtx.playing,
      volume: audioCtx.volume,
      wasMuted: audioCtx.muted,
    };

    // Pause radio
    if (audioCtx.playing) {
      audioCtx.pause();
    }
    
    // Mute radio
    if (!audioCtx.muted) {
      audioCtx.toggleMute(true);
    }

    // Mark preview as active
    audioCtx.setPreviewActive(true);
    setPreviewSongId(song.id);

    const url = `/api/music/file/${song.id}`;

    console.log(`[Preview] Starting playback for song ${song.id}: ${song.title}`);
    console.log(`[Preview] URL: ${url}`);

    try {
      // Create audio element
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = audioCtx.volume / 100;
      
      previewRef.current = audio;

      // Handle when preview ends naturally
      const onEnded = () => {
        // Verify this is still the active preview
        if (previewRef.current === audio) {
          console.log(`[Preview] Song ${song.id} ended naturally`);
          stopPreviewAndRestoreRadio();
        }
      };

      // Handle errors
      const onError = (e: Event) => {
        // Verify this is still the active preview
        if (previewRef.current !== audio) return;
        
        const target = e.target as HTMLAudioElement;
        const error = target.error;
        let errorMsg = "Erro desconhecido";
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              // Silently ignore aborted errors (user stopped)
              console.log("Preview aborted by user");
              return;
            case error.MEDIA_ERR_NETWORK:
              errorMsg = "Erro de rede ao carregar arquivo";
              break;
            case error.MEDIA_ERR_DECODE:
              errorMsg = "Erro ao decodificar áudio";
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMsg = "Arquivo não encontrado ou não suportado";
              break;
          }
          console.error("[Preview] Playback error:", errorMsg, error.message || "", error);
        }
        
        toast.error(errorMsg);
        stopPreviewAndRestoreRadio();
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      
      // Add loadedmetadata listener to debug
      audio.addEventListener("loadedmetadata", () => {
        console.log(`[Preview] Metadata loaded, duration: ${audio.duration}s`);
      });

      // Set source and play
      console.log(`[Preview] Setting src to: ${url}`);
      audio.src = url;
      
      try {
        console.log(`[Preview] Calling play()...`);
        await audio.play();
        console.log(`[Preview] Play successful!`);
        toast.success(`Tocando: ${song.title}`);
      } catch (playError: any) {
        // Handle play interruption gracefully
        if (playError.name === "AbortError") {
          console.log("Play interrupted - this is normal when stopping quickly");
          return;
        }
        console.error("[Preview] Play error:", playError);
        throw playError;
      }
    } catch (err) {
      console.error("[Preview] Setup error:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro ao carregar música";
      toast.error(errorMsg);
      stopPreviewAndRestoreRadio();
    }
  };

  if (artist === null || artist === undefined) return null;
  if (loading) return <div className="text-center py-8">Carregando músicas...</div>;
  if (!songs || songs.length === 0) return <div className="text-center py-8">Nenhuma música encontrada para este artista.</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-primary/20">
            <th className="px-4 py-2">Capa</th>
            <th className="px-4 py-2">Título</th>
            <th className="px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s) => {
            const isPlaying = previewSongId === s.id;
            return (
              <tr key={s.id} className={`border-t border-primary/10 hover:bg-surface/50 transition ${isPlaying ? 'bg-primary/10' : ''}`}>
                <td className="px-4 py-3">
                  <div className="w-12 h-12 relative rounded overflow-hidden">
                    <Image src={s.cover || "/images/logotipo.svg"} alt={s.title} fill sizes="48px" className="object-cover" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-sm text-muted">{s.artist}</div>
                </td>
                <td className="px-4 py-3">
                  <button 
                    onClick={() => handlePlayPreview(s)} 
                    aria-label={isPlaying ? `Parar ${s.title}` : `Tocar ${s.title}`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded transition ${
                      isPlaying 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-primary hover:bg-primary/80 text-background'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5 3.5h6v9H5z" />
                        </svg>
                        <span className="text-sm">Parar</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M10.804 8 5 11.618V4.382L10.804 8z" />
                        </svg>
                        <span className="text-sm">Tocar</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
