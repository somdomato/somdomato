"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchSongs, requestSong } from "@/actions/requests";
import { useGenre } from "@/context/GenreContext";
import { useAudio } from "@/context/AudioContext";
import { buildStreamUrl } from "@/config";
import { GenreWarningModal } from "@/components/GenreWarningModal";
import Image from "next/image";
import {
  X,
  Search,
  Music,
  Loader2,
  Download,
  Check,
  Globe,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AdminAuth";
import { EditSongModal } from "@/components/EditSongModal";
import { useLive } from "@/context/LiveContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeezerResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

interface DeezerDownloadProgress {
  trackId: string;
  progress: number;
  status: string;
  message: string;
}

interface Song {
  id: number;
  title: string;
  artist: string;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  rotation: string | null;
  album: string | null;
  genre: string | null;
  allowedInGeneral: number | null;
}

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DURATION_SECONDS = 10 * 60;
const DEEZER_LIMIT = 10;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestModal({ isOpen, onClose }: RequestModalProps) {
  const { live, djName } = useLive();

  // Mode
  const [mode, setMode] = useState<"radio" | "internet">("radio");

  // Radio state
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [showGenreWarning, setShowGenreWarning] = useState(false);
  const [pendingSongId, setPendingSongId] = useState<number | null>(null);

  // Internet state
  const [internetQuery, setInternetQuery] = useState("");
  const [deezerResults, setDeezerResults] = useState<DeezerResult[]>([]);
  const [deezerTotal, setDeezerTotal] = useState(0);
  const [deezerPage, setDeezerPage] = useState(1);
  const [deezerPages, setDeezerPages] = useState(0);
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [deezerSearched, setDeezerSearched] = useState(false);
  const [showDeezerForm, setShowDeezerForm] = useState<DeezerResult | null>(
    null,
  );
  const [deezerFormData, setDeezerFormData] = useState({
    title: "",
    artist: "",
  });
  const [deezerDownloading, setDeezerDownloading] =
    useState<DeezerDownloadProgress | null>(null);

  const { currentGenre, setGenre } = useGenre();
  const { playing, play } = useAudio();
  const { isAuthenticated } = useAuth();

  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const queryInputRef = useRef<HTMLInputElement | null>(null);
  const internetInputRef = useRef<HTMLInputElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // ---------------------------------------------------------------------------
  // Radio search
  // ---------------------------------------------------------------------------

  const loadRadioSongs = useCallback(
    async (opts: { query?: string; letter?: string; pageParam?: number }) => {
      const { query = "", letter = "", pageParam = 1 } = opts;
      setLoading(true);
      setHasSearched(true);
      try {
        const data = await searchSongs({
          query,
          letter,
          page: pageParam,
          limit: 10,
        });
        setSongs(data.songs);
        setTotal(data.total);
        setPages(data.pages);
        setPage(pageParam);
      } catch {
        toast.error("Erro ao carregar músicas");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleRadioSearch = () => {
    setActiveLetter(null);
    loadRadioSongs({ query, pageParam: 1 });
  };

  const handleLetterClick = (letter: string) => {
    const next = activeLetter === letter ? null : letter;
    setActiveLetter(next);
    setQuery("");
    if (next) {
      loadRadioSongs({ letter: next, pageParam: 1 });
    } else {
      setSongs([]);
      setHasSearched(false);
    }
  };

  const changeRadioPage = (newPage: number) => {
    loadRadioSongs({ query, letter: activeLetter ?? "", pageParam: newPage });
  };

  // ---------------------------------------------------------------------------
  // Internet search
  // ---------------------------------------------------------------------------

  const searchInternet = useCallback(async (q: string, pageParam = 1) => {
    if (!q.trim()) return;
    setDeezerLoading(true);
    try {
      const index = (pageParam - 1) * DEEZER_LIMIT;
      const res = await fetch(
        `/api/deezer/search?q=${encodeURIComponent(q)}&limit=${DEEZER_LIMIT}&index=${index}`,
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setDeezerResults(data.results || []);
      setDeezerTotal(data.total || 0);
      setDeezerPages(Math.ceil((data.total || 0) / DEEZER_LIMIT));
      setDeezerPage(pageParam);
      setDeezerSearched(true);
    } catch {
      toast.error("Erro ao pesquisar na internet");
    } finally {
      setDeezerLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Deezer download
  // ---------------------------------------------------------------------------

  const handleSelectDeezerTrack = (track: DeezerResult) => {
    setDeezerFormData({ title: track.title, artist: track.artist });
    setShowDeezerForm(track);
  };

  const handleDeezerDownload = async () => {
    if (
      !showDeezerForm ||
      !deezerFormData.title.trim() ||
      !deezerFormData.artist.trim()
    ) {
      toast.error("Preencha todos os campos");
      return;
    }
    const trackSnapshot = showDeezerForm;
    setDeezerDownloading({
      trackId: trackSnapshot.id,
      progress: 0,
      status: "starting",
      message: "Iniciando...",
    });
    setShowDeezerForm(null);

    try {
      const response = await fetch("/api/deezer/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: trackSnapshot.id,
          title: deezerFormData.title.trim(),
          artist: deezerFormData.artist.trim(),
          thumbnail: trackSnapshot.thumbnail,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              toast.error(data.error);
              setDeezerDownloading(null);
              return;
            }
            if (data.done) {
              toast.success(data.message || "Enviado! Aguardando aprovação.");
              setDeezerDownloading(null);
              onClose();
              return;
            }
            setDeezerDownloading((prev) => ({
              trackId: prev?.trackId || trackSnapshot.id,
              progress: data.progress ?? prev?.progress ?? 0,
              status: data.status ?? prev?.status ?? "",
              message: data.message ?? prev?.message ?? "",
            }));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      toast.error("Erro no envio");
      setDeezerDownloading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Request handling
  // ---------------------------------------------------------------------------

  const performRequest = async (songId: number) => {
    setRequesting(songId);
    try {
      const result = await requestSong(songId);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Erro ao fazer pedido");
    } finally {
      setRequesting(null);
    }
  };

  const handleRequest = async (songId: number) => {
    if (currentGenre !== "geral") {
      setPendingSongId(songId);
      setShowGenreWarning(true);
      return;
    }
    await performRequest(songId);
  };

  // ---------------------------------------------------------------------------
  // Focus trap / keyboard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) {
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
      return;
    }

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;
    setTimeout(() => queryInputRef.current?.focus(), 50);

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const container = modalRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setMode("radio");
    setQuery("");
    setInternetQuery("");
    setActiveLetter(null);
    setSongs([]);
    setHasSearched(false);
    setPage(1);
    setTotal(0);
    setPages(0);
    setDeezerResults([]);
    setDeezerSearched(false);
    setDeezerPage(1);
    setDeezerDownloading(null);
    setShowDeezerForm(null);
  }, [isOpen]);

  // Focus right input when mode changes
  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      if (mode === "radio") queryInputRef.current?.focus();
      else internetInputRef.current?.focus();
    }, 50);
  }, [mode, isOpen]);

  if (!isOpen) return null;

  const showNotGeralWarning = currentGenre !== "geral";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {showGenreWarning && pendingSongId && (
        <GenreWarningModal
          onConfirm={async () => {
            setShowGenreWarning(false);
            setGenre("geral");
            if (playing) {
              await performRequest(pendingSongId);
              setTimeout(() => play(buildStreamUrl("geral")), 100);
            } else {
              await performRequest(pendingSongId);
            }
            setPendingSongId(null);
          }}
          onCancel={() => {
            setShowGenreWarning(false);
            setPendingSongId(null);
          }}
        />
      )}

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="requestModalTitle"
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-9999 p-4 backdrop-blur-sm"
      >
        <div className="bg-background-alt rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-primary/25">
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-3">
              <Music className="w-5 h-5 text-primary" />
              <h2
                id="requestModalTitle"
                className="text-lg font-bold text-white m-0"
              >
                Pedir Música
              </h2>
            </div>
            <button
              aria-label="Fechar"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Live mode ── */}
          {live ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                AO VIVO
              </span>
              <p className="text-base text-white font-semibold">
                {djName ? (
                  <>
                    <strong>{djName}</strong> está ao vivo!
                  </>
                ) : (
                  "Estamos ao vivo!"
                )}
              </p>
              <p className="text-sm text-muted max-w-sm">
                Os pedidos de música estão temporariamente desabilitados durante
                a transmissão ao vivo. Faça seu pedido pelo{" "}
                <strong className="text-primary">bate-papo</strong> direto com o
                locutor!
              </p>
            </div>
          ) : (
            <>
              {/* ── Genre warning ── */}
              {showNotGeralWarning && (
                <div className="px-5 py-2.5 bg-amber-950/60 border-b border-amber-600/20 shrink-0">
                  <p className="text-xs text-amber-300/90">
                    Ouvindo{" "}
                    <strong className="text-amber-400">
                      {currentGenre.charAt(0).toUpperCase() +
                        currentGenre.slice(1)}
                    </strong>{" "}
                    — pedidos tocam no{" "}
                    <strong className="text-amber-400">Geral</strong> e você
                    será trocado automaticamente.
                  </p>
                </div>
              )}

              {/* ── Search controls ── */}
              <div className="px-5 pt-4 pb-3 border-b border-white/8 shrink-0 space-y-3">
                {/* Mode toggle (radio input) */}
                <div className="flex">
                  <div className="inline-flex rounded-xl bg-background/60 border border-white/8 p-1 gap-1">
                    {(["radio", "internet"] as const).map((m) => (
                      <label
                        key={m}
                        className={`
                      relative flex items-center gap-2 px-4 py-1.5 rounded-lg cursor-pointer select-none
                      text-sm font-semibold transition-all duration-200
                      ${
                        mode === m
                          ? m === "radio"
                            ? "bg-primary text-background shadow-md"
                            : "bg-emerald-600 text-white shadow-md"
                          : "text-gray-400 hover:text-white"
                      }
                    `}
                      >
                        <input
                          type="radio"
                          name="search-mode"
                          value={m}
                          checked={mode === m}
                          onChange={() => setMode(m)}
                          className="sr-only"
                        />
                        {m === "radio" ? (
                          <>
                            <Music className="w-3.5 h-3.5 shrink-0" />
                            <span>Na Rádio</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span>Na Internet</span>
                          </>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Search input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    {mode === "radio" ? (
                      <input
                        ref={queryInputRef}
                        type="text"
                        aria-label="Buscar músicas na rádio"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setActiveLetter(null);
                        }}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleRadioSearch()
                        }
                        placeholder="Buscar por artista ou título..."
                        className="w-full pl-9 pr-3 py-2.5 bg-background/70 border border-primary/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm placeholder:text-gray-600 transition-colors"
                      />
                    ) : (
                      <input
                        ref={internetInputRef}
                        type="text"
                        aria-label="Buscar músicas na internet"
                        value={internetQuery}
                        onChange={(e) => setInternetQuery(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && searchInternet(internetQuery)
                        }
                        placeholder="Buscar por artista ou título..."
                        className="w-full pl-9 pr-3 py-2.5 bg-background/70 border border-emerald-600/25 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/40 text-sm placeholder:text-gray-600 transition-colors"
                      />
                    )}
                  </div>
                  <button
                    onClick={
                      mode === "radio"
                        ? handleRadioSearch
                        : () => searchInternet(internetQuery)
                    }
                    disabled={mode === "internet" && !internetQuery.trim()}
                    className={`
                  px-4 py-2.5 font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0
                  ${
                    mode === "radio"
                      ? "bg-primary hover:bg-primary/85 text-background"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }
                `}
                  >
                    Buscar
                  </button>
                </div>

                {/* Letter buttons (radio mode only) */}
                {mode === "radio" && (
                  <div className="flex flex-wrap gap-1">
                    {LETTERS.map((letter) => (
                      <button
                        key={letter}
                        onClick={() => handleLetterClick(letter)}
                        className={`
                      w-7 h-7 rounded-lg text-xs font-bold transition-all active:scale-90
                      ${
                        activeLetter === letter
                          ? "bg-primary text-background shadow-md"
                          : "bg-background/60 border border-white/8 text-gray-400 hover:border-primary/40 hover:text-primary"
                      }
                    `}
                        aria-label={`Filtrar por ${letter}`}
                        aria-pressed={activeLetter === letter}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Results ── */}
              <div className="flex-1 overflow-y-auto">
                {/* Download progress */}
                {deezerDownloading && (
                  <div className="m-4 p-4 bg-background/60 border border-primary/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <Music
                        className="text-primary animate-pulse shrink-0"
                        size={18}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {deezerDownloading.message}
                        </p>
                        <p className="text-xs text-gray-500">
                          {deezerDownloading.status}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {deezerDownloading.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${deezerDownloading.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Radio results ── */}
                {mode === "radio" && !deezerDownloading && (
                  <>
                    {loading && (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                    )}
                    {!loading && !hasSearched && (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                        <Music className="w-10 h-10 opacity-20" />
                        <p className="text-sm">
                          Use a busca ou selecione uma letra acima
                        </p>
                      </div>
                    )}
                    {!loading && hasSearched && songs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                        <Music className="w-9 h-9 opacity-20" />
                        <p className="text-sm">
                          Nenhuma música encontrada na rádio
                        </p>
                        {query.trim() && (
                          <button
                            onClick={() => {
                              setMode("internet");
                              setInternetQuery(query);
                              setTimeout(() => searchInternet(query), 50);
                            }}
                            className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                          >
                            Buscar na internet
                          </button>
                        )}
                      </div>
                    )}
                    {!loading && hasSearched && songs.length > 0 && (
                      <table className="w-full text-sm">
                        <thead className="bg-background/80 sticky top-0 z-10">
                          <tr className="border-b border-white/6">
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 w-12" />
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                              Artista
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">
                              Música
                            </th>
                            <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 w-20">
                              Ação
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {songs.map((song) => (
                            <tr
                              key={song.id}
                              className="border-b border-white/5 hover:bg-white/3 transition-colors"
                            >
                              <td className="px-4 py-2.5">
                                <div className="w-9 h-9 relative rounded-lg overflow-hidden shadow">
                                  <Image
                                    src={song.cover || "/images/logotipo.svg"}
                                    alt={song.title}
                                    fill
                                    sizes="36px"
                                    className="object-cover"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-white truncate max-w-32 sm:max-w-52">
                                  {song.artist}
                                </div>
                                <div className="text-xs text-gray-500 truncate max-w-32 sm:hidden">
                                  {song.title}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 hidden sm:table-cell">
                                <div className="text-gray-300 truncate max-w-64">
                                  {song.title}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="inline-flex items-center gap-1">
                                  {isAuthenticated && (
                                    <button
                                      onClick={() => setEditingSong(song)}
                                      className="p-1.5 text-white/30 hover:text-primary transition rounded-lg hover:bg-white/5"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRequest(song.id)}
                                    disabled={requesting === song.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                  >
                                    {requesting === song.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Music className="w-3 h-3" />
                                    )}
                                    {requesting === song.id ? "..." : "Pedir"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                {/* ── Internet results ── */}
                {mode === "internet" &&
                  !deezerDownloading &&
                  (deezerLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : !deezerSearched ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                      <Globe className="w-10 h-10 opacity-20" />
                      <p className="text-sm">
                        Pesquise músicas que ainda não estão na rádio
                      </p>
                      <p className="text-xs text-gray-600">
                        Após o envio, a equipe vai avaliar o pedido
                      </p>
                    </div>
                  ) : deezerResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                      <Globe className="w-9 h-9 opacity-20" />
                      <p className="text-sm">Nenhum resultado encontrado</p>
                      <p className="text-xs text-gray-600">
                        Tente com outros termos
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-gray-500 mb-3">
                        {deezerTotal} resultado{deezerTotal !== 1 ? "s" : ""}{" "}
                        encontrado{deezerTotal !== 1 ? "s" : ""}
                      </p>
                      {deezerResults.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 p-3 bg-background/50 border border-white/6 rounded-xl hover:border-emerald-600/30 transition-colors"
                        >
                          <Image
                            src={track.thumbnail}
                            alt={track.title}
                            width={44}
                            height={44}
                            className="rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {track.title}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {track.artist}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {formatDuration(track.duration)}
                              {track.duration > MAX_DURATION_SECONDS && (
                                <span className="text-red-400 ml-2">
                                  Excede 10 min
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectDeezerTrack(track)}
                            disabled={track.duration > MAX_DURATION_SECONDS}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all active:scale-95 shrink-0 text-xs"
                          >
                            <Download size={12} />
                            <span className="hidden sm:inline">Enviar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>

              {/* ── Pagination ── */}
              {mode === "radio" && songs.length > 0 && pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/6 bg-background/30 shrink-0">
                  <span className="text-xs text-gray-600">
                    Página {page} de {pages} · {total} músicas
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => changeRadioPage(page - 1)}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs bg-background/60 border border-white/8 rounded-lg hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => changeRadioPage(page + 1)}
                      disabled={page === pages}
                      className="px-3 py-1.5 text-xs bg-background/60 border border-white/8 rounded-lg hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}

              {mode === "internet" && deezerPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/6 bg-background/30 shrink-0">
                  <span className="text-xs text-gray-600">
                    Página {deezerPage} de {deezerPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        searchInternet(internetQuery, deezerPage - 1)
                      }
                      disabled={deezerPage === 1}
                      className="px-3 py-1.5 text-xs bg-background/60 border border-white/8 rounded-lg hover:border-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() =>
                        searchInternet(internetQuery, deezerPage + 1)
                      }
                      disabled={deezerPage === deezerPages}
                      className="px-3 py-1.5 text-xs bg-background/60 border border-white/8 rounded-lg hover:border-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirm send modal ── */}
      {showDeezerForm && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-10000 p-4">
          <div className="bg-background-alt border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-base font-bold text-white m-0">
                Confirmar Envio
              </h3>
              <button
                onClick={() => setShowDeezerForm(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3 mb-4 p-3 bg-background/50 rounded-xl border border-white/6">
              <Image
                src={showDeezerForm.thumbnail}
                alt={showDeezerForm.title}
                width={48}
                height={48}
                className="rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {showDeezerForm.title}
                </p>
                <p className="text-xs text-gray-400">{showDeezerForm.artist}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatDuration(showDeezerForm.duration)}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Confirme os dados antes de enviar para avaliação.
            </p>

            <div className="space-y-2.5 mb-4">
              <div>
                <label
                  htmlFor="deezer-artist"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Artista *
                </label>
                <input
                  id="deezer-artist"
                  type="text"
                  value={deezerFormData.artist}
                  onChange={(e) =>
                    setDeezerFormData((p) => ({ ...p, artist: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="Nome do artista"
                />
              </div>
              <div>
                <label
                  htmlFor="deezer-title"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Título *
                </label>
                <input
                  id="deezer-title"
                  type="text"
                  value={deezerFormData.title}
                  onChange={(e) =>
                    setDeezerFormData((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  placeholder="Título da música"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeezerForm(null)}
                className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg transition-colors text-sm text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeezerDownload}
                disabled={
                  !deezerFormData.title.trim() || !deezerFormData.artist.trim()
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/85 disabled:opacity-50 text-background font-semibold rounded-lg transition-all active:scale-95 text-sm"
              >
                <Check size={14} />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSong && (
        <EditSongModal
          song={editingSong}
          onClose={() => setEditingSong(null)}
          onSave={() => {
            setEditingSong(null);
            if (hasSearched) {
              loadRadioSongs({
                query,
                letter: activeLetter ?? "",
                pageParam: page,
              });
            }
          }}
        />
      )}
    </>
  );
}
