"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchSongs, requestSong } from "@/app/pedidos/actions";
import Image from "next/image";
import { X, Search, Music, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

  // Manage focus when opening/closing modal and keyboard traps
  useEffect(() => {
    if (isOpen) {
      // store previously focused element so we can restore focus on close
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;

      // focus search input when modal opens
      setTimeout(() => searchInputRef.current?.focus(), 0);

      const focusableSelectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }

        if (e.key === "Tab") {
          const container = modalRef.current;
          if (!container) return;
          const focusables = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter((el) => !el.hasAttribute("disabled"));
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
      loadSongs("", 1);
    }
  }, [isOpen, loadSongs]);

  const handleSearch = () => {
    setPage(1);
    loadSongs(searchQuery, 1);
  };

  const changePage = (newPage: number) => {
    setPage(newPage);
    loadSongs(searchQuery, newPage);
  };

  const handleRequest = async (songId: number) => {
    setRequesting(songId);
    try {
      const result = await requestSong(songId);
      if (result.success) {
        toast.success(result.message);
        // Opcional: fechar o modal após pedido bem-sucedido
        // onClose();
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

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="requestModalTitle" aria-describedby="requestModalDescription" className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-background-alt rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-primary/30">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-primary/30 bg-gradient-to-r from-background-alt to-background">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-primary" />
            <h2 id="requestModalTitle" className="text-xl sm:text-2xl font-bold text-primary">
              Pedir Música
            </h2>
          </div>
          <button aria-label="Fechar pedidos" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-background rounded-full">
            <X size={24} />
          </button>
        </div>

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
            <button onClick={handleSearch} className="px-4 sm:px-6 py-2.5 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-colors whitespace-nowrap">
              Buscar
            </button>
          </div>
          <p id="requestModalDescription" className="text-xs text-gray-400 mt-2">
            {total > 0 ? `${total} música${total !== 1 ? "s" : ""} encontrada${total !== 1 ? "s" : ""}` : "Digite para buscar músicas"}
          </p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Music className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Nenhuma música encontrada</p>
              <p className="text-sm mt-2">Tente buscar com outros termos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background sticky top-0">
                  <tr className="border-b border-primary/30">
                    <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold">Capa</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold">Artista</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold hidden sm:table-cell">Música</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-xs sm:text-sm font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr key={song.id} className="border-b border-primary/10 hover:bg-background/50 transition-colors">
                      <td className="px-3 sm:px-4 py-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 relative rounded overflow-hidden shadow-md">
                          <Image src={song.cover || "/images/logotipo.svg"} alt={song.title} fill sizes="48px" className="object-cover" />
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[200px]">{song.artist}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[120px] sm:max-w-[200px] sm:hidden">{song.title}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <div className="text-sm text-gray-300 truncate max-w-[250px]">{song.title}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleRequest(song.id)}
                            disabled={requesting === song.id}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex items-center gap-2"
                          >
                            {requesting === song.id ? (
                              <>
                                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                                <span className="hidden sm:inline">Pedindo...</span>
                              </>
                            ) : (
                              <>
                                <Music className="w-3 h-3 sm:w-4 sm:h-4" />
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
              <button onClick={() => changePage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 sm:px-4 py-2 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm">
                Anterior
              </button>
              <button onClick={() => changePage(Math.min(pages, page + 1))} disabled={page === pages} className="px-3 sm:px-4 py-2 bg-background border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
