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
        previewRef.current.pause();
        previewRef.current.src = "";
        previewRef.current.remove();
        previewRef.current = null;
      try {
        previewRef.current.pause();
        previewRef.current.removeEventListener("ended", stopPreviewAndRestoreRadio);
        previewRef.current.removeEventListener("error", handlePreviewError);
        previewRef.current.src = "";
        previewRef.current.remove();
      } catch (e) {
        console.warn("Error cleaning up preview:", e);
      }
      previewRef.current = null;
    }
    
    setPreviewSongId(null);
    audioCtx.setPreviewActive(false);

    // Restore radio state
    if (savedStateRef.current) {
      const { wasPlaying, wasMuted } = savedStateRef.current;
      
      // Restore mute state first
      if (!wasMuted && audioCtx.muted) {
        audioCtx.toggleMute(false);
      }
      
      // Resume playing if it was playing before
      if (wasPlaying && !audioCtx.playing) {
        setTimeout(() => audioCtx.play(), 100);
      }
      
      savedStateRef.current = null;
    }
  }, [audioCtx]);

  // Error handler for preview
  const handlePreviewError = React.useCallback((e: Event) => {
    const target = e.target as HTMLAudioElement;
    const error = target.error;
    let errorMsg = "Erro desconhecido";
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMsg = "Reprodução abortada";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMsg = "Erro de rede ao carregar arquivo";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMsg = "Erro ao decodificar áudio";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Arquivo não disponível ou formato não suportado";
          break;
      }
      console.error("Preview playback error:", errorMsg, error.message || "");
    }
    
    toast.error(errorMsg);
    stopPreviewAndRestoreRadio();
  }, [stopPreviewAndRestoreRadioSongId(null);
    audioCtx.setPreviewActive(false);

    // Restore radio state
    if (savedStateRef.current) {
      const { wasPlaying, wasMuted } = savedStateRef.current;
      
      // Restore mute state
      if (!wasMuted) {
        audioCtx.toggleMute(false);
      }
      
      // Resume playing if it was playing before
      if (wasPlaying) {
        audioCtx.play();
      }
      
      savedStateRef.current = null;
    }
  }, [audioCtx]);

  const handlePlayPreview = async (song: Song) => {
    // IfCreate audio element
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = audioCtx.volume / 100;
      
      previewRef.current = audio;

      // Setup event listeners before setting src
      audio.addEventListener("ended", stopPreviewAndRestoreRadio);
      audio.addEventListener("error", handlePreviewError);

      // Set source and load
      audio.src = url;
      await audio.play();
      = audio;

      // Handle when preview ends naturally
      audio.addEventListener("ended", () => {
        stopPreviewAndRestoreRadio();
      });

      // Handle errors with more detail
      audio.addEventListener("error", (e) => {
        const target = e.target as HTMLAudioElement;
        const error = target.error;
        let errorMsg = "Erro desconhecido";
        
        if (error) {
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMsg = "Reprodução abortada";
              break;
            case error.MEDIA_ERR_NETWORK:
              errorMsg = "Erro de rede";
              break;
            case error.MEDIA_ERR_DECODE:
              errorMsg = "Erro ao decodificar áudio";
              break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMsg = "Formato não suportado";
              break;
          }
          console.error("Preview playback error:", errorMsg, error.message);
        }
        
        toast.error(`Erro ao reproduzir: ${errorMsg}`);
        stopPreviewAndRestoreRadio();
      });

      await audio.play();
      toast.success(`Tocando: ${song.title}`);
    } catch (err) {
      console.error("Preview error:", err);
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
