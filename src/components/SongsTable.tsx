"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { EditSongModal } from "@/components/EditSongModal";
import {
  Pencil,
  Trash2,
  Search,
  CopyX,
  ArrowUp,
  ArrowDown,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DuplicatesPanel } from "@/components/DuplicatesPanel";

async function fetchSongs(
  page: number,
  limit: number,
  query = "",
  genre?: string,
) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    query: query,
  });
  if (genre) params.set("genre", genre);
  const res = await fetch(`/api/admin/songs?${params}`);
  if (!res.ok) throw new Error("failed to fetch songs");
  return res.json();
}

async function apiDeleteSong(id: number) {
  const res = await fetch(`/api/admin/songs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("failed to delete");
  return res.json();
}

interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string | null;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  rotation: string | null;
  genre: string | null;
  allowedInGeneral: number | null;
  createdAt: Date | null;
  requests: number | null;
  likes: number | null;
}

export function SongsTable() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof Song>("artist");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [recoveringCoverId, setRecoveringCoverId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.permissions) setPermissions(d.permissions);
      })
      .catch(() => {});
  }, []);

  const handleSort = (column: keyof Song) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedSongs = [...songs].sort((a, b) => {
    const valA = a[sortColumn];
    const valB = b[sortColumn];
    const strA = String(valA ?? "").toLowerCase();
    const strB = String(valB ?? "").toLowerCase();
    const cmp = strA.localeCompare(strB);
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSongs(
        page,
        limit,
        searchQuery,
        genreFilter || undefined,
      );
      setSongs(data.songs);
      setTotal(data.total);
      setPages(data.pages);
    } catch (error) {
      toast.error("Erro ao carregar músicas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, genreFilter]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${title}"?`)) return;

    try {
      await apiDeleteSong(id);
      toast.success("Música deletada com sucesso!");
      loadSongs();
    } catch (error) {
      toast.error("Erro ao deletar música");
      console.error(error);
    }
  };

  const handleRecoverCover = async (id: number) => {
    setRecoveringCoverId(id);
    try {
      const res = await fetch(`/api/admin/songs/${id}/recover-cover`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("failed to recover cover");
      const data = await res.json();
      toast.success(
        data.recovered ? "Capa recuperada!" : "Nenhuma capa encontrada",
      );
      loadSongs();
    } catch (error) {
      toast.error("Erro ao recuperar capa");
      console.error(error);
    } finally {
      setRecoveringCoverId(null);
    }
  };

  const getTimeSlotsText = (slots: number | null) => {
    if (!slots) return "Nenhum";
    if ((slots & 15) === 15) return "Todos";
    const times = [];
    if (slots & 1) times.push("Madrugada");
    if (slots & 2) times.push("Manhã");
    if (slots & 4) times.push("Tarde");
    if (slots & 8) times.push("Noite");
    return times.join(", ") || "Nenhum";
  };

  const getRotationColor = (rotation: string | null) => {
    switch (rotation) {
      case "inativo":
        return "text-gray-500";
      case "ultraleve":
        return "text-cyan-400";
      case "leve":
        return "text-blue-400";
      case "normal":
        return "text-green-400";
      case "pesado":
        return "text-orange-400";
      case "ultrapesada":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle duplicatas */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowDuplicates((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
            showDuplicates
              ? "bg-orange-900/40 border-orange-500/50 text-orange-300 hover:bg-orange-900/60"
              : "bg-background border-primary/30 text-gray-300 hover:bg-primary/10"
          }`}
        >
          <CopyX size={16} />
          {showDuplicates ? "Ver todas as músicas" : "Verificar duplicatas"}
        </button>
      </div>

      {showDuplicates ? (
        <DuplicatesPanel />
      ) : (
        <>
          {/* Campo de Busca e Filtro de Gênero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Buscar por música, artista ou arquivo..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="relative">
              <select
                value={genreFilter}
                onChange={(e) => {
                  setGenreFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos os gêneros</option>
                <option value="geral">Geral</option>
                <option value="gaucha">Gaúcha</option>
                <option value="modao">Modão</option>
                <option value="arrocha">Arrocha</option>
                <option value="romantico">Romântico</option>
              </select>
            </div>
          </div>

          {/* Controles */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="limit" className="text-sm">
                Mostrar:
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-1 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={1000}>1000</option>
              </select>
              <span className="text-sm">registros por página</span>
            </div>

            <div className="text-sm">
              Total: <span className="font-bold text-primary">{total}</span>{" "}
              músicas
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto bg-background-alt rounded-lg shadow-lg">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="border-2 border-white/10 border-t-primary rounded-full animate-spin w-6 h-6" />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary/30">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Capa
                    </th>
                    {(
                      [
                        ["path", "Arquivo"],
                        ["artist", "Artista"],
                        ["title", "Título"],
                        ["genre", "Gênero"],
                        ["rotation", "Rotação"],
                        ["timeSlots", "Horários"],
                      ] as [keyof Song, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer select-none hover:text-primary transition-colors"
                        onClick={() => handleSort(key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {sortColumn === key &&
                            (sortDirection === "asc" ? (
                              <ArrowUp size={14} />
                            ) : (
                              <ArrowDown size={14} />
                            ))}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-sm font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSongs.map((song) => (
                    <tr
                      key={song.id}
                      className="border-b border-primary/10 hover:bg-background/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Image
                          src={song.cover || "/images/logotipo.svg"}
                          alt={song.title}
                          width={48}
                          height={48}
                          className="object-cover rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">
                        {song.path.split("/").pop()}
                      </td>
                      <td
                        className="px-4 py-3 text-sm max-w-50 truncate"
                        title={song.artist}
                      >
                        {song.artist}
                      </td>
                      <td
                        className="px-4 py-3 text-sm max-w-50 truncate"
                        title={song.title}
                      >
                        {song.title}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs">
                          {song.genre || "geral"}
                        </span>
                        {song.allowedInGeneral === 1 &&
                          song.genre !== "geral" && (
                            <span
                              className="ml-1 text-xs text-green-400"
                              title="Permitida no Geral"
                            >
                              ✓
                            </span>
                          )}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold ${getRotationColor(song.rotation)}`}
                      >
                        {song.rotation || "normal"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {getTimeSlotsText(song.timeSlots)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {(permissions.includes("songs:edit_tags") ||
                            permissions.includes("songs:edit_file")) && (
                            <button
                              onClick={() => setEditingSong(song)}
                              className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={18} />
                            </button>
                          )}

                          {/* Recuperar capa (disco → ID3 → Deezer) */}
                          {permissions.includes("songs:edit_tags") && (
                            <button
                              onClick={() => handleRecoverCover(song.id)}
                              disabled={recoveringCoverId === song.id}
                              className="p-2 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Recuperar capa"
                            >
                              <ImageIcon
                                size={18}
                                className={
                                  recoveringCoverId === song.id
                                    ? "animate-pulse"
                                    : ""
                                }
                              />
                            </button>
                          )}

                          {/* Pedir a música (admin-only UI) */}
                          {permissions.includes("requests:manage") && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    "/api/admin/request",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ songId: song.id }),
                                    },
                                  );
                                  const data = await res.json();
                                  if (!res.ok)
                                    throw new Error(
                                      data?.error || "Falha ao pedir música",
                                    );
                                  toast.success("Pedido adicionado");
                                } catch (err) {
                                  toast.error("Erro ao pedir música");
                                  console.error(err);
                                }
                              }}
                              className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                              title="Pedir"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 5v14"></path>
                                <path d="M5 12h14"></path>
                              </svg>
                            </button>
                          )}

                          {/* Tocar agora (força tocar imediatamente) */}
                          {permissions.includes("requests:manage") && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch("/api/admin/play", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ songId: song.id }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok)
                                    throw new Error(
                                      data?.error || "Falha ao tocar agora",
                                    );
                                  toast.success("Tocando agora (solicitado)");
                                  loadSongs();
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Erro ao tocar agora",
                                  );
                                  console.error(err);
                                }
                              }}
                              className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                              title="Tocar agora"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                              </svg>
                            </button>
                          )}

                          {permissions.includes("songs:delete") && (
                            <button
                              onClick={() => handleDelete(song.id, song.title)}
                              className="p-2 text-red-400 hover:text-red-300 transition-colors"
                              title="Deletar"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Página {page} de {pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(pages, page + 1))}
                disabled={page === pages}
                className="px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>

          {/* Modal de Edição */}
          {editingSong && (
            <EditSongModal
              song={editingSong}
              onClose={() => setEditingSong(null)}
              onSave={() => {
                setEditingSong(null);
                loadSongs();
              }}
              onCoverReset={() => {
                // Atualiza a lista sem fechar o modal
                loadSongs();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
