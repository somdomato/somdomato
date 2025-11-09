"use client";

import { useState, useTransition } from "react";
import { SearchSongs, RequestSong } from "@/actions/song";
import type { SongData } from "@/types/song";
import { Search, Music, Loader2, Heart, Check } from "lucide-react";
import Image from "next/image";

interface SearchFormClientProps {
  initialSongs?: SongData[];
}

export default function SearchFormClient({ initialSongs = [] }: SearchFormClientProps) {
  const [songs, setSongs] = useState<SongData[]>(initialSongs);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [requestingIds, setRequestingIds] = useState<Set<number>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setHasSearched(true);
    
    startTransition(async () => {
      try {
        const results = await SearchSongs(searchTerm.trim());
        setSongs(results);
      } catch (error) {
        console.error("Erro ao buscar músicas:", error);
        setSongs([]);
      }
    });
  };

  const handleRequestSong = async (songId: number) => {
    if (requestingIds.has(songId) || requestedIds.has(songId)) return;

    setRequestingIds(prev => new Set([...prev, songId]));
    
    startTransition(async () => {
      try {
        const result = await RequestSong(songId);
        if (result.success) {
          setRequestedIds(prev => new Set([...prev, songId]));
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error("Erro ao pedir música:", error);
        alert("Erro ao pedir música. Tente novamente.");
      } finally {
        setRequestingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(songId);
          return newSet;
        });
      }
    });
  };

  return (
    <>
      <h2
        id="modalTitle"
        className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white mb-6"
      >
        Pedir Música
      </h2>

      <div className="space-y-6">
        {/* Formulário de Busca */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="song" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
              Nome da Música ou Artista
            </label>
            <div className="relative">
              <input
                type="text"
                id="song"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-teal-500 dark:focus:border-teal-500"
                placeholder="Digite o nome da música ou artista"
                required
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isPending || !searchTerm.trim()}
            className="w-full flex items-center justify-center gap-2 text-white bg-teal-600 hover:bg-teal-700 focus:ring-4 focus:outline-none focus:ring-teal-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-teal-600 dark:hover:bg-teal-700 dark:focus:ring-teal-800"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="size-4" />
                Buscar
              </>
            )}
          </button>
        </form>

        {/* Resultados da Busca */}
        <div className="space-y-4">
          {isPending && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-teal-600" />
            </div>
          )}

          {!isPending && hasSearched && songs.length === 0 && (
            <div className="text-center py-8">
              <Music className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma música encontrada para "{searchTerm}"
              </p>
            </div>
          )}

          {!isPending && songs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resultados encontrados ({songs.length})
              </h3>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {songs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    {/* Capa da Música */}
                    <div className="shrink-0">
                      <Image
                        src={song.cover || "/images/logotipo.svg"}
                        alt={`Capa de ${song.title}`}
                        width={48}
                        height={48}
                        className="rounded-md object-cover"
                      />
                    </div>
                    
                    {/* Informações da Música */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {song.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {song.artist}
                      </p>
                    </div>
                    
                    {/* Botão de Pedir */}
                    <button
                      onClick={() => handleRequestSong(song.id)}
                      disabled={requestingIds.has(song.id) || requestedIds.has(song.id)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        requestedIds.has(song.id)
                          ? "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
                          : "text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/40"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {requestingIds.has(song.id) ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Enviando...
                        </>
                      ) : requestedIds.has(song.id) ? (
                        <>
                          <Check className="size-4" />
                          Pedido!
                        </>
                      ) : (
                        <>
                          <Heart className="size-4" />
                          Pedir
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
