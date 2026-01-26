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
  const prevMutedRef = React.useRef<boolean>(false);
  const isPreviewActiveRef = React.useRef<boolean>(false);
  const [previewSongId, setPreviewSongId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!artist) return;
    setLoading(true);
    fetch(`/api/artists/${encodeURIComponent(artist)}/songs`)
      .then((r) => r.json())
      .then((data) => setSongs(data.songs || []))
      .finally(() => setLoading(false));
  }, [artist]);

  const previewObjectUrlRef = React.useRef<string | null>(null);

  // Keep preview volume in sync with global control while preview is active
  React.useEffect(() => {
    if (previewRef.current) {
      try {
        previewRef.current.volume = audioCtx.volume / 100;
      } catch {}
    }
  }, [audioCtx.volume]);

  // If user unmutes the main player while the persistent mute toast is shown, clear the flag and show confirmation
  React.useEffect(() => {
    if (!audioCtx.muted && muteToastRef.current) {
      muteToastRef.current = false;
      toast.success("Rádio desmutado");
    }
  }, [audioCtx.muted]);

  // Stop current preview (cleanup and restore radio mute state)
  const stopPreview = React.useCallback(() => {
    isPreviewActiveRef.current = false;
    setPreviewSongId(null);

    if (previewRef.current) {
      try {
        previewRef.current.pause();
        previewRef.current.src = "";
      } catch {}
      previewRef.current = null;
    }

    if (previewObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch {}
      previewObjectUrlRef.current = null;
    }

    // restore previous muted state
    if (!prevMutedRef.current) audioCtx.toggleMute(false);
  }, [audioCtx]);

  // When preview ends naturally: **leave main radio muted** and show persistent toast with action to unmute
  const muteToastRef = React.useRef<boolean>(false);

  const onPreviewEnded = React.useCallback(() => {
    isPreviewActiveRef.current = false;
    setPreviewSongId(null);

    // cleanup preview element
    if (previewRef.current) {
      try {
        previewRef.current.pause();
        previewRef.current.src = "";
      } catch {}
      previewRef.current = null;
    }

    if (previewObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch {}
      previewObjectUrlRef.current = null;
    }

    // At this point keep main radio muted and notify user
    if (!muteToastRef.current) {
      muteToastRef.current = true;
      toast("Stream está no mudo", {
        duration: 0,
        action: {
          label: "Desmutar",
          onClick: () => {
            audioCtx.toggleMute(false);
            toast.success("Rádio desmutado");
            muteToastRef.current = false;
          },
        },
      });
    }
  }, [audioCtx]);

  // When preview is paused (not ended), restore previous mute state
  const onPreviewPause = React.useCallback(() => {
    // if the preview ended, ignore pause (ended handler will run)
    if (!isPreviewActiveRef.current) return;

    // if audio ended, do nothing (ended handler manages it)
    if (previewRef.current?.ended) return;

    stopPreview();
  }, [stopPreview]);

  const handlePlayPreview = async (song: Song) => {
    // If same song is playing, stop it
    if (previewSongId === song.id && isPreviewActiveRef.current) {
      stopPreview();
      return;
    }

    // If another preview is playing, stop it first
    if (isPreviewActiveRef.current) stopPreview();

    const url = `/api/music/file/${song.id}`;

    // remember previous muted state and mute main radio
    prevMutedRef.current = audioCtx.muted;
    audioCtx.toggleMute(true);

    isPreviewActiveRef.current = true;
    setPreviewSongId(song.id);

    try {
      // Try direct playback first (better for headers/CORS). If it fails, fallback to fetching blob.
      const audio = new Audio(url);
      audio.volume = audioCtx.volume / 100;
      audio.muted = false; // ensure preview audible
      previewRef.current = audio;

      const playDirect = async () => {
        try {
          await audio.play();
          audio.addEventListener("ended", onPreviewEnded);
          audio.addEventListener("pause", onPreviewPause);
        } catch (e) {
          console.warn("Direct audio.play() failed, falling back to blob fetch:", e);
          // try fallback
          await playFallback();
        }
      };

      const playFallback = async () => {
        // cleanup possible direct audio
        if (previewRef.current) {
          try {
            previewRef.current.pause();
          } catch {}
          previewRef.current.src = "";
          previewRef.current = null;
        }

        const res = await fetch(url);
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const clone = res.clone();
            const json = await clone.json().catch(() => null);
            if (json?.error) msg = json.error + (json?.message ? `: ${json.message}` : "");
            else {
              const txt = await res.text().catch(() => null);
              if (txt) msg = txt.slice(0, 200);
            }
          } catch {}
          throw new Error(`file not available: ${msg}`);
        }

        const ctype = res.headers.get("content-type") || "";
        if (!ctype.startsWith("audio")) {
          // try to read as json to show server message
          let msg = "unsupported content-type";
          try {
            const clone2 = res.clone();
            const json2 = await clone2.json().catch(() => null);
            if (json2?.message) msg = json2.message;
            else {
              const txt = await res.text().catch(() => null);
              if (txt) msg = txt.slice(0, 200);
            }
          } catch {}
          throw new Error(`unsupported content-type: ${msg}`);
        }

        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        previewObjectUrlRef.current = objUrl;

        const blobAudio = new Audio(objUrl);
        blobAudio.volume = audioCtx.volume / 100;
        blobAudio.muted = false;
        previewRef.current = blobAudio;
        try {
          await blobAudio.play();
          blobAudio.addEventListener("ended", onPreviewEnded);
          blobAudio.addEventListener("pause", onPreviewPause);
        } catch (e) {
          stopPreview();
          throw e;
        }
      };

      await playDirect();

      // update UI metadata
      audioCtx.setTitle(song.title);
      audioCtx.setArtist(song.artist);
      if (song.cover) audioCtx.setCover(song.cover);
    } catch (err) {
      console.error("preview fetch error", err);
      // show friendly console message for debugging
      if (err instanceof Error) console.error("Preview failed:", err.message);
      stopPreview();
    }
  };

  if (!artist) return null;
  if (loading) return <div>Carregando músicas...</div>;
  if (!songs || songs.length === 0) return <div>Nenhuma música encontrada para este artista.</div>;

  return (
    <div className="overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-4 py-2">Capa</th>
            <th className="px-4 py-2">Título</th>
            <th className="px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-3">
                <div className="w-12 h-12 relative rounded overflow-hidden">
                  <Image src={s.cover || "/images/logotipo.svg"} alt={s.title} fill sizes="48px" className="object-cover" />
                </div>
              </td>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3">
                <button onClick={() => handlePlayPreview(s)} aria-label={`Tocar ${s.title}`} className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-background rounded">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.804 8 5 11.618V4.382L10.804 8z" />
                  </svg>
                  <span className="sr-only">Tocar</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
