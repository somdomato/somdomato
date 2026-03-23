"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  ListOrdered,
  Upload,
  Check,
  X,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";
import { GENRES } from "@/config";

interface UploadItem {
  id: number;
  title: string;
  artist: string;
  deezerUrl: string;
  deezerId: string;
  thumbnail: string | null;
  filename: string;
  status: string;
  createdAt: Date | null;
}

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [_total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">(
    "pending",
  );
  const [processing, setProcessing] = useState<number | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<UploadItem | null>(
    null,
  );
  const [selectedGenre, setSelectedGenre] = useState("geral");

  const loadUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/uploads?status=${filter}&page=${page}&limit=20`,
      );
      const data = await res.json();
      setUploads(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
    } catch (error) {
      toast.error("Erro ao carregar envios");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const handleApprove = async (upload: UploadItem) => {
    setShowApproveModal(upload);
  };

  const confirmApprove = async () => {
    if (!showApproveModal) return;

    setProcessing(showApproveModal.id);
    try {
      const res = await fetch(`/api/admin/uploads/${showApproveModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", genre: selectedGenre }),
      });

      if (!res.ok) throw new Error("Failed to approve");

      toast.success("Música aprovada e adicionada à biblioteca!");
      setShowApproveModal(null);
      loadUploads();
    } catch (error) {
      toast.error("Erro ao aprovar música");
      console.error(error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Tem certeza que deseja rejeitar este envio?")) return;

    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/uploads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });

      if (!res.ok) throw new Error("Failed to reject");

      toast.success("Envio rejeitado");
      loadUploads();
    } catch (error) {
      toast.error("Erro ao rejeitar envio");
      console.error(error);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar este envio?")) return;

    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/uploads/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Envio deletado");
      loadUploads();
    } catch (error) {
      toast.error("Erro ao deletar envio");
      console.error(error);
    } finally {
      setProcessing(null);
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
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors"
            >
              <Music size={20} />
              Músicas
            </Link>
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors"
            >
              <ListOrdered size={20} />
              Pedidos
            </Link>
            <div className="flex items-center gap-2 px-6 py-3 border-b-2 border-primary text-primary">
              <Upload size={20} />
              Envios
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(["pending", "approved", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? "bg-primary text-white"
                  : "bg-background-alt text-gray-400 hover:text-white"
              }`}
            >
              {status === "pending" && "Pendentes"}
              {status === "approved" && "Aprovados"}
              {status === "rejected" && "Rejeitados"}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Upload className="mx-auto mb-4 opacity-50" size={48} />
            <p>Nenhum envio encontrado</p>
          </div>
        ) : (
          <div className="bg-background-alt rounded-lg border border-primary/20 overflow-hidden">
            <table className="w-full">
              <thead className="bg-background">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Música
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Artista
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Deezer
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-background/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {upload.thumbnail && (
                          <Image
                            src={upload.thumbnail}
                            alt={upload.title}
                            width={48}
                            height={36}
                            className="rounded object-cover"
                          />
                        )}
                        <span className="font-medium">{upload.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{upload.artist}</td>
                    <td className="px-4 py-3">
                      <a
                        href={upload.deezerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Ver <ExternalLink size={14} />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {filter === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(upload)}
                              disabled={processing === upload.id}
                              className="p-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors"
                              title="Aprovar"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleReject(upload.id)}
                              disabled={processing === upload.id}
                              className="p-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors"
                              title="Rejeitar"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(upload.id)}
                          disabled={processing === upload.id}
                          className="p-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded transition-colors"
                          title="Deletar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded ${
                  page === p
                    ? "bg-primary text-white"
                    : "bg-background-alt hover:bg-background"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background-alt border border-primary/30 rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Aprovar Música</h3>

            <div className="mb-4">
              <p className="text-gray-300">
                <strong>{showApproveModal.title}</strong>
              </p>
              <p className="text-gray-400">{showApproveModal.artist}</p>
            </div>

            <div className="mb-6">
              <label
                htmlFor="genre"
                className="block text-sm text-gray-400 mb-2"
              >
                Selecione o gênero
              </label>
              <select
                id="genre"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-primary/30 rounded-lg focus:outline-none focus:border-primary"
              >
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(null)}
                className="flex-1 px-4 py-2 border border-gray-600 hover:bg-background rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmApprove}
                disabled={processing === showApproveModal.id}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
