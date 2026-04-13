"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Upload,
  ScrollText,
  Users,
  Megaphone,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";

async function fetchRequests(page: number, limit: number) {
  const res = await fetch(`/api/admin/requests?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error("failed to fetch requests");
  return res.json();
}

async function fetchDeleteRequest(id: number) {
  const res = await fetch(`/api/admin/request/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("failed to delete request");
  return res.json();
}

async function fetchAddRequest(songId: number) {
  const res = await fetch(`/api/admin/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId }),
  });
  if (!res.ok) throw new Error("failed to add request");
  return res.json();
}

async function fetchReorder(requestId: number, newOrder: number) {
  const res = await fetch(`/api/admin/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, newOrder }),
  });
  if (!res.ok) throw new Error("failed to reorder");
  return res.json();
}

async function fetchSongsForSelect() {
  const res = await fetch(`/api/admin/songs/select`);
  if (!res.ok) throw new Error("failed to fetch songs");
  return res.json();
}

interface Request {
  id: number;
  order: number;
  createdAt: Date | null;
  song: {
    id: number;
    title: string;
    artist: string;
    path: string;
    cover: string | null;
  } | null;
}

interface SongOption {
  id: number;
  title: string;
  artist: string;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [songs, setSongs] = useState<SongOption[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRequests(page, limit);
      setRequests(data.requests);
      setTotal(data.total);
      setPages(data.pages);
    } catch (error) {
      toast.error("Erro ao carregar pedidos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  const loadSongs = useCallback(async () => {
    try {
      const allSongs = await fetchSongsForSelect();
      setSongs(allSongs);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (showAddModal) {
      loadSongs();
    }
  }, [showAddModal, loadSongs]);

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar este pedido?")) return;

    try {
      await fetchDeleteRequest(id);
      toast.success("Pedido deletado com sucesso!");
      loadRequests();
    } catch (error) {
      toast.error("Erro ao deletar pedido");
      console.error(error);
    }
  };

  const handleAdd = async () => {
    if (!selectedSongId) {
      toast.error("Selecione uma música");
      return;
    }

    setAdding(true);
    try {
      await fetchAddRequest(selectedSongId);
      toast.success("Pedido adicionado com sucesso!");
      setShowAddModal(false);
      setSelectedSongId(null);
      loadRequests();
    } catch (error) {
      toast.error("Erro ao adicionar pedido");
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleReorder = async (requestId: number, direction: "up" | "down") => {
    const currentRequest = requests.find((r) => r.id === requestId);
    if (!currentRequest) return;

    const currentIndex = requests.findIndex((r) => r.id === requestId);
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= requests.length) return;

    const targetRequest = requests[targetIndex];

    try {
      await fetchReorder(requestId, targetRequest.order);
      toast.success("Ordem atualizada!");
      loadRequests();
    } catch (error) {
      toast.error("Erro ao reordenar");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm hover:text-primary transition-colors"
            >
              Ver Site
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-background-alt border-b border-primary/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Music size={18} />
              <span className="hidden sm:inline">Músicas</span>
            </Link>
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-primary text-primary whitespace-nowrap text-sm">
              <ListOrdered size={18} />
              <span className="hidden sm:inline">Pedidos</span>
            </div>
            <Link
              href="/admin/uploads"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Envios</span>
            </Link>
            <Link
              href="/admin/vinhetas"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Megaphone size={18} />
              <span className="hidden sm:inline">Vinhetas</span>
            </Link>
            <Link
              href="/admin/logs"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ScrollText size={18} />
              <span className="hidden sm:inline">Logs</span>
            </Link>
            <Link
              href="/admin/usuarios"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Users size={18} />
              <span className="hidden sm:inline">Usuários</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-4">
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

            <div className="flex items-center gap-4">
              <div className="text-sm">
                Total: <span className="font-bold text-primary">{total}</span>{" "}
                pedidos
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-md transition-colors"
              >
                <Plus size={18} />
                Adicionar Pedido
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto bg-background-alt rounded-lg shadow-lg">
            {loading ? (
              <div className="p-8 text-center">Carregando...</div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nenhum pedido na fila
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary/30">
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Ordem
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Capa
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Música
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Artista
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request, index) => (
                    <tr
                      key={request.id}
                      className="border-b border-primary/10 hover:bg-background/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-primary">
                        #{request.order}
                      </td>
                      <td className="px-4 py-3">
                        <Image
                          src={request.song?.cover || "/images/logotipo.svg"}
                          alt={request.song?.title || ""}
                          width={48}
                          height={48}
                          className="object-cover rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {request.song?.title}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {request.song?.artist}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleReorder(request.id, "up")}
                            disabled={index === 0}
                            className="p-2 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para cima"
                          >
                            <ArrowUp size={18} />
                          </button>
                          <button
                            onClick={() => handleReorder(request.id, "down")}
                            disabled={index === requests.length - 1}
                            className="p-2 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(request.id)}
                            className="p-2 text-red-400 hover:text-red-300 transition-colors"
                            title="Deletar"
                          >
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
        </div>
      </main>

      {/* Modal Adicionar Pedido */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-alt rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-primary/30">
              <h2 className="text-xl font-bold text-primary">
                Adicionar Pedido
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedSongId(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="song"
                  className="block text-sm font-medium mb-2"
                >
                  Selecione a Música
                </label>
                <select
                  id="song"
                  value={selectedSongId || ""}
                  onChange={(e) => setSelectedSongId(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Escolha uma música...</option>
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.artist} - {song.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedSongId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-background/80 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding || !selectedSongId}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
