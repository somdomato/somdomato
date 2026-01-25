"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { getSongs, deleteSong } from "@/actions/admin";
import { EditSongModal } from "@/components/EditSongModal";
import { Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string | null;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  rotation: string | null;
  createdAt: Date | null;
  requests: number | null;
  likes: number | null;
}

interface SongsTableProps {
  password: string;
}

export function SongsTable({ password }: SongsTableProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSongs(page, limit, password, searchQuery);
      setSongs(data.songs);
      setTotal(data.total);
      setPages(data.pages);
    } catch (error) {
      toast.error("Erro ao carregar músicas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, password, searchQuery]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Tem certeza que deseja deletar "${title}"?`)) return;

    try {
      await deleteSong(id, password);
      toast.success("Música deletada com sucesso!");
      loadSongs();
    } catch (error) {
      toast.error("Erro ao deletar música");
      console.error(error);
    }
  };

  const getTimeSlotsText = (slots: number | null) => {
    if (!slots) return "Nenhum";
    const times = [];
    if (slots & 1) times.push("Madrugada");
    if (slots & 2) times.push("Manhã");
    if (slots & 4) times.push("Tarde");
    if (slots & 8) times.push("Noite");
    return times.join(", ") || "Todos";
  };

  const getRotationColor = (rotation: string | null) => {
    switch (rotation) {
      case "inativo":
        return "text-gray-500";
      case "leve":
        return "text-blue-400";
      case "normal":
        return "text-green-400";
      case "pesado":
        return "text-orange-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="space-y-4">
      {/* Campo de Busca */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
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
          Total: <span className="font-bold text-primary">{total}</span> músicas
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto bg-background-alt rounded-lg shadow-lg">
        {loading ? (
          <div className="p-8 text-center">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary/30">
                <th className="px-4 py-3 text-left text-sm font-semibold">Capa</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Arquivo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Artista</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Título</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Rotação</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Horários</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr key={song.id} className="border-b border-primary/10 hover:bg-background/50 transition-colors">
                  <td className="px-4 py-3">
                    <Image src={song.cover || "/images/logotipo.svg"} alt={song.title} width={48} height={48} className="object-cover rounded" />
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{song.path.split("/").pop()}</td>
                  <td className="px-4 py-3 text-sm">{song.artist}</td>
                  <td className="px-4 py-3 text-sm">{song.title}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${getRotationColor(song.rotation)}`}>{song.rotation || "normal"}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{getTimeSlotsText(song.timeSlots)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setEditingSong(song)} className="p-2 text-blue-400 hover:text-blue-300 transition-colors" title="Editar">
                        <Pencil size={18} />
                      </button>

                      {/* Pedir a música (admin-only UI - password do admin é passada via prop) */}
                      <button
                        onClick={async () => {
                          if (!password) {
                            toast.error("Senha de admin necessária");
                            return;
                          }
                          try {
                            const res = await fetch("/api/admin/request", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ songId: song.id, password }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || "Falha ao pedir música");
                            toast.success("Pedido adicionado");
                          } catch (err) {
                            toast.error("Erro ao pedir música");
                            console.error(err);
                          }
                        }}
                        className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="Pedir"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14"></path>
                          <path d="M5 12h14"></path>
                        </svg>
                      </button>

                      {/* Tocar agora (força tocar imediatamente) */}
                      <button
                        onClick={async () => {
                          if (!password) {
                            toast.error("Senha de admin necessária");
                            return;
                          }
                          try {
                            const res = await fetch("/api/admin/play", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ songId: song.id, password }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || "Falha ao tocar agora");
                            toast.success("Tocando agora (solicitado)");
                            // Opcional: atualizar UI/lista
                            loadSongs();
                          } catch (err) {
                            toast.error("Erro ao tocar agora");
                            console.error(err);
                          }
                        }}
                        className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                        title="Tocar agora"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </button>

                      <button onClick={() => handleDelete(song.id, song.title)} className="p-2 text-red-400 hover:text-red-300 transition-colors" title="Deletar">
                        <Trash2 size={18} />
                      </button>
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
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Anterior
          </button>
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Próxima
          </button>
        </div>
      </div>

      {/* Modal de Edição */}
      {editingSong && (
        <EditSongModal
          song={editingSong}
          password={password}
          onClose={() => setEditingSong(null)}
          onSave={() => {
            setEditingSong(null);
            loadSongs();
          }}
        />
      )}
    </div>
  );
}
