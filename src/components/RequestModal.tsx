"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchSongs, requestSong } from "@/actions/requests";
import { useGenre } from "@/context/GenreContext";
import { useAudio } from "@/context/AudioContext";
import { buildStreamUrl } from "@/config";
import { GenreWarningModal } from "@/components/GenreWarningModal";
import Image from "next/image";
import { X, Search, Music, Loader2, Download, Check } from "lucide-react";
import { toast } from "sonner";

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

const MAX_DURATION_SECONDS = 10 * 60;
const DEEZER_LIMIT = 10;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Song {
  id: number;
  title: string;
  artist: string;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  rotation: string | null;
}

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RequestModal({ isOpen, onClose }: RequestModalProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [showGenreWarning, setShowGenreWarning] = useState(false);
  const [pendingSongId, setPendingSongId] = useState<number | null>(null);

  // Deezer fallback state
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

  // Accessibility refs
  const modalRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const loadSongs = useCallback(
    async (query: string, pageParam: number = 1) => {
      setLoading(true);
      try {
        const data = await searchSongs({ query, page: pageParam, limit });
        setSongs(data.songs);
        setTotal(data.total);
        setPages(data.pages);
        setPage(pageParam);
      } catch (error) {
        toast.error("Erro ao carregar músicas");
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  const searchDeezer = useCallback(
    async (query: string, pageParam: number = 1) => {
      if (!query.trim()) return;
      setDeezerLoading(true);
      try {
        const index = (pageParam - 1) * DEEZER_LIMIT;
        const res = await fetch(
          `/api/deezer/search?q=${encodeURIComponent(query)}&limit=${DEEZER_LIMIT}&index=${index}`,
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
      } catch (error) {
        toast.error("Erro ao pesquisar no Deezer");
        console.error(error);
      } finally {
        setDeezerLoading(false);
      }
    },
    [],
  );

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

    setDeezerDownloading({
      trackId: showDeezerForm.id,
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
          trackId: showDeezerForm.id,
          title: deezerFormData.title.trim(),
          artist: deezerFormData.artist.trim(),
          thumbnail: showDeezerForm.thumbnail,
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
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                toast.error(data.error);
                setDeezerDownloading(null);
                return;
              }
              if (data.done) {
                toast.success(
                  data.message || "Download concluído! Aguardando moderação.",
                );
                setDeezerDownloading(null);
                return;
              }
              setDeezerDownloading((prev) => ({
                trackId: prev?.trackId || showDeezerForm.id,
                progress: data.progress || prev?.progress || 0,
                status: data.status || prev?.status || "",
                message: data.message || prev?.message || "",
              }));
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      toast.error("Erro no download");
      console.error(error);
      setDeezerDownloading(null);
    }
  };

  // Manage focus when opening/closing modal and keyboard traps
  useEffect(() => {
    if (isOpen) {
      // store previously focused element so we can restore focus on close
      previousActiveElementRef.current =
        document.activeElement as HTMLElement | null;

      // focus search input when modal opens
      setTimeout(() => searchInputRef.current?.focus(), 0);

      const focusableSelectors =
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }

        if (e.key === "Tab") {
          const container = modalRef.current;
          if (!container) return;
          const focusables = Array.from(
            container.querySelectorAll<HTMLElement>(focusableSelectors),
          ).filter((el) => !el.hasAttribute("disabled"));
          if (focusables.length === 0) {
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
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    // restore focus to previously focused element when modal closes
    if (!isOpen && previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      // Ao abrir o modal, limpar o campo de busca e carregar todas as músicas
      setSearchQuery("");
      setPage(1);
      setDeezerResults([]);
      setDeezerSearched(false);
      setDeezerTotal(0);
      setDeezerPages(0);
      setDeezerPage(1);
      setDeezerDownloading(null);
      setShowDeezerForm(null);
      loadSongs("", 1);
    }
  }, [isOpen, loadSongs]);

  const handleSearch = () => {
    setPage(1);
    setDeezerResults([]);
    setDeezerSearched(false);
    setDeezerPage(1);
    loadSongs(searchQuery, 1);
  };

  const changePage = (newPage: number) => {
    setPage(newPage);
    loadSongs(searchQuery, newPage);
  };

  const handleRequest = async (songId: number) => {
    // Se não está no Geral, mostrar aviso
    if (currentGenre !== "geral") {
      setPendingSongId(songId);
      setShowGenreWarning(true);
      return;
    }

    // Está no Geral, fazer pedido diretamente
    await performRequest(songId);
  };

  const performRequest = async (songId: number) => {
    setRequesting(songId);
    try {
      const result = await requestSong(songId);
      if (result.success) {
        toast.success(result.message);
        // Fechar o modal e limpar o formulário após pedido bem-sucedido
        setSearchQuery("");
        setSongs([]);
        setPage(1);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Erro ao fazer pedido");
      console.error(error);
    } finally {
      setRequesting(null);
    }
  };

  if (!isOpen) return null;

  // Mostrar warning se não está no geral
  const showNotGeralWarning = currentGenre !== "geral";

  return (
    <>
      {/* Genre Warning Modal */}
      {showGenreWarning && pendingSongId && (
        <GenreWarningModal
          onConfirm={async () => {
            setShowGenreWarning(false);
            // Trocar para Geral
            setGenre("geral");
            if (playing) {
              await performRequest(pendingSongId);
              const streamUrl = buildStreamUrl("geral");
              setTimeout(() => play(streamUrl), 100);
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
        aria-describedby="requestModalDescription"
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-9999 p-4 backdrop-blur-sm"
      >
        <div className="bg-background-alt rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-primary/30">
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-6 border-b border-primary/30 bg-linear-to-r from-background-alt to-background">
            <div className="flex items-center gap-3">
              <Music className="w-6 h-6 text-primary" />
              <h2
                id="requestModalTitle"
                className="text-xl sm:text-2xl font-bold text-primary"
              >
                Pedir Música
              </h2>
            </div>
            <button
              aria-label="Fechar pedidos"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-background rounded-full"
            >
              <X size={24} />
            </button>
          </div>

          {/* Warning Banner - Mostrar quando não está no Geral */}
          {showNotGeralWarning && (
            <div className="px-4 sm:px-6 py-3 bg-amber-900/30 border-b border-amber-600/30">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-5 h-5 mt-0.5 text-amber-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1 text-sm">
                  <p className="text-amber-200 font-medium">
                    Você está ouvindo:{" "}
                    <span className="text-amber-400">
                      {currentGenre.charAt(0).toUpperCase() +
                        currentGenre.slice(1)}
                    </span>
                  </p>
                  <p className="text-amber-300/80 mt-0.5">
                    Pedidos só são tocados no mountpoint{" "}
                    <strong className="text-amber-400">Geral</strong>. Ao fazer
                    um pedido, você será trocado automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="p-4 sm:p-6 border-b border-primary/30 bg-background/50">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label="Buscar músicas"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Buscar por artista, música ou arquivo..."
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 sm:px-6 py-2.5 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                Buscar
              </button>
            </div>
            <p
              id="requestModalDescription"
              className="text-xs text-gray-400 mt-2"
            >
              {total > 0
                ? `${total} música${total !== 1 ? "s" : ""} encontrada${total !== 1 ? "s" : ""}`
                : "Digite para buscar músicas"}
            </p>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : songs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                {/* Download progress inside empty state */}
                {deezerDownloading && (
                  <div className="w-full max-w-md mb-6 p-4 bg-background border border-primary/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="animate-pulse">
                        <Music className="text-primary" size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {deezerDownloading.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {deezerDownloading.status}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {deezerDownloading.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-background-alt rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300 ease-out"
                        style={{ width: `${deezerDownloading.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {!deezerSearched && !deezerLoading && !deezerDownloading && (
                  <>
                    <Music className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-base">
                      Nenhuma música encontrada na rádio
                    </p>
                    {searchQuery.trim() && (
                      <button
                        onClick={() => searchDeezer(searchQuery, 1)}
                        className="mt-4 px-5 py-2.5 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        <Search className="w-4 h-4" />
                        Buscar no Deezer
                      </button>
                    )}
                    {!searchQuery.trim() && (
                      <p className="text-sm mt-2">
                        Tente buscar com outros termos
                      </p>
                    )}
                  </>
                )}

                {deezerLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}

                {deezerSearched &&
                  !deezerLoading &&
                  deezerResults.length === 0 &&
                  !deezerDownloading && (
                    <>
                      <Music className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-base">Nenhum resultado no Deezer</p>
                      <p className="text-sm mt-2">
                        Tente buscar com outros termos
                      </p>
                    </>
                  )}

                {deezerResults.length > 0 && !deezerDownloading && (
                  <div className="w-full text-left">
                    <div className="px-4 sm:px-6 pb-3">
                      <p className="text-sm text-gray-300">
                        Não encontramos na rádio, mas achamos{" "}
                        <strong className="text-primary">{deezerTotal}</strong>{" "}
                        resultado{deezerTotal !== 1 ? "s" : ""} no Deezer:
                      </p>
                    </div>
                    <div className="space-y-2 px-4 sm:px-6">
                      {deezerResults.map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 p-3 bg-background border border-primary/20 rounded-lg hover:border-primary/40 transition-colors"
                        >
                          <Image
                            src={track.thumbnail}
                            alt={track.title}
                            width={48}
                            height={48}
                            className="rounded object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white truncate">
                              {track.title}
                            </h3>
                            <p className="text-xs text-gray-400 truncate">
                              {track.artist}
                            </p>
                            <p className="text-xs text-gray-500">
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
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-lg transition-colors shrink-0 text-xs sm:text-sm"
                          >
                            <Download size={14} />
                            <span className="hidden sm:inline">Enviar</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Deezer Pagination */}
                    {deezerPages > 1 && (
                      <div className="flex justify-between items-center px-4 sm:px-6 pt-4">
                        <div className="text-xs text-gray-400">
                          Página {deezerPage} de {deezerPages}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              searchDeezer(
                                searchQuery,
                                Math.max(1, deezerPage - 1),
                              )
                            }
                            disabled={deezerPage === 1}
                            className="px-3 py-1.5 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() =>
                              searchDeezer(
                                searchQuery,
                                Math.min(deezerPages, deezerPage + 1),
                              )
                            }
                            disabled={deezerPage === deezerPages}
                            className="px-3 py-1.5 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                          >
                            Próxima
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background sticky top-0">
                    <tr className="border-b border-primary/30">
                      <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold">
                        Capa
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold">
                        Artista
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold hidden sm:table-cell">
                        Música
                      </th>
                      <th className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-semibold">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {songs.map((song) => (
                      <tr
                        key={song.id}
                        className="border-b border-primary/10 hover:bg-background/50 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-3">
                          <div className="w-10 h-8 sm:w-12 sm:h-10 relative rounded overflow-hidden shadow-md">
                            <Image
                              src={song.cover || "/images/logotipo.svg"}
                              alt={song.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        </td>
                        <td className="px-3 sm:px-3 py-2">
                          <div className="text-sm font-semibold text-white truncate max-w-30 sm:max-w-50">
                            {song.artist}
                          </div>
                          <div className="text-xs text-gray-400 truncate max-w-30 sm:max-w-50 sm:hidden">
                            {song.title}
                          </div>
                        </td>
                        <td className="px-3 sm:px-3 py-2 hidden sm:table-cell">
                          <div className="text-sm text-gray-300 truncate max-w-62.5">
                            {song.title}
                          </div>
                        </td>
                        <td className="px-3 sm:px-3 py-2">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleRequest(song.id)}
                              disabled={requesting === song.id}
                              className="px-3 sm:px-3 py-1 sm:py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center gap-2"
                            >
                              {requesting === song.id ? (
                                <>
                                  <Loader2 className="w-3 h-2 sm:w-4 sm:h-3 animate-spin" />
                                  <span className="hidden sm:inline">
                                    Pedindo...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Music className="w-3 h-2 sm:w-4 sm:h-3" />
                                  <span>Pedir</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer com Paginação */}
          {songs.length > 0 && (
            <div className="flex justify-between items-center p-4 sm:p-6 border-t border-primary/30 bg-background/50">
              <div className="text-xs sm:text-sm text-gray-400">
                Página {page} de {pages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => changePage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 sm:px-4 py-2 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                >
                  Anterior
                </button>
                <button
                  onClick={() => changePage(Math.min(pages, page + 1))}
                  disabled={page === pages}
                  className="px-3 sm:px-4 py-2 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deezer Download Confirmation Modal */}
      {showDeezerForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-10000 p-4">
          <div className="bg-background-alt border border-primary/30 rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-primary">
                Confirmar Envio
              </h3>
              <button
                onClick={() => setShowDeezerForm(null)}
                className="p-1 hover:bg-background rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-4 mb-6">
              <Image
                src={showDeezerForm.thumbnail}
                alt={showDeezerForm.title}
                width={64}
                height={64}
                className="rounded object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm text-gray-300 truncate">
                  {showDeezerForm.title}
                </p>
                <p className="text-xs text-gray-500">{showDeezerForm.artist}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDuration(showDeezerForm.duration)}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label
                  htmlFor="deezer-artist"
                  className="block text-sm text-gray-400 mb-1"
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
                  className="w-full px-4 py-2 bg-background border border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Nome do artista"
                />
              </div>
              <div>
                <label
                  htmlFor="deezer-title"
                  className="block text-sm text-gray-400 mb-1"
                >
                  Título da Música *
                </label>
                <input
                  id="deezer-title"
                  type="text"
                  value={deezerFormData.title}
                  onChange={(e) =>
                    setDeezerFormData((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full px-4 py-2 bg-background border border-primary/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Título da música"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeezerForm(null)}
                className="flex-1 px-4 py-2 border border-gray-600 hover:bg-background rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeezerDownload}
                disabled={
                  !deezerFormData.title.trim() || !deezerFormData.artist.trim()
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-background font-semibold rounded-lg transition-colors text-sm"
              >
                <Check size={16} />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
