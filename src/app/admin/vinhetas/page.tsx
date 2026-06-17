"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Music,
  ListOrdered,
  Upload,
  ScrollText,
  Users,
  Megaphone,
  BarChart3,
  Trash2,
  Plus,
  Loader2,
  Play,
  Pause,
  Settings,
  Power,
  PowerOff,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";

interface JingleItem {
  id: number;
  title: string;
  filename: string;
  path: string;
  duration: number | null;
  active: number | null;
  createdAt: string | null;
}

export default function VinhetasPage() {
  const [jingleList, setJingleList] = useState<JingleItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [jingleInterval, setJingleInterval] = useState(5);
  const [savedInterval, setSavedInterval] = useState(5);
  const [savingInterval, setSavingInterval] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadJingles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jingles?page=${page}&limit=25`);
      const data = await res.json();
      setJingleList(data.items || []);
      setPages(data.pages || 0);
      setTotal(data.total || 0);
      setJingleInterval(data.jingleInterval || 5);
      setSavedInterval(data.jingleInterval || 5);
    } catch {
      toast.error("Erro ao carregar vinhetas");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadJingles();
  }, [loadJingles]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      toast.error("Preencha o título e selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle.trim());

      const res = await fetch("/api/admin/jingles", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao enviar vinheta");
        return;
      }

      toast.success("Vinheta adicionada!");
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadJingles();
    } catch {
      toast.error("Erro ao enviar vinheta");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deletar esta vinheta?")) return;

    try {
      const res = await fetch(`/api/admin/jingles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Erro ao deletar vinheta");
        return;
      }
      toast.success("Vinheta deletada");
      loadJingles();
    } catch {
      toast.error("Erro ao deletar vinheta");
    }
  };

  const handleToggleActive = async (
    id: number,
    currentActive: number | null,
  ) => {
    const newActive = currentActive === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/admin/jingles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) {
        toast.error("Erro ao atualizar vinheta");
        return;
      }
      setJingleList((prev) =>
        prev.map((j) => (j.id === id ? { ...j, active: newActive } : j)),
      );
    } catch {
      toast.error("Erro ao atualizar vinheta");
    }
  };

  const handleSaveInterval = async () => {
    setSavingInterval(true);
    try {
      const res = await fetch("/api/admin/jingles/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: jingleInterval }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar configuração");
        return;
      }
      setSavedInterval(jingleInterval);
      toast.success("Intervalo atualizado!");
    } catch {
      toast.error("Erro ao salvar configuração");
    } finally {
      setSavingInterval(false);
    }
  };

  const handlePlay = (jingle: JingleItem) => {
    if (playingId === jingle.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(`/api/admin/jingles/${jingle.id}/stream`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      toast.error("Erro ao reproduzir vinheta");
    };
    audio.play();
    audioRef.current = audio;
    setPlayingId(jingle.id);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
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
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <ListOrdered size={18} />
              <span className="hidden sm:inline">Pedidos</span>
            </Link>
            <Link
              href="/admin/uploads"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Envios</span>
            </Link>
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-primary text-primary whitespace-nowrap text-sm">
              <Megaphone size={18} />
              <span className="hidden sm:inline">Vinhetas</span>
            </div>
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
            <Link
              href="/admin/estatisticas"
              className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-transparent text-gray-400 hover:text-white transition-colors whitespace-nowrap text-sm"
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Estatísticas</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Settings Card */}
          <div className="bg-background-alt border border-primary/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={18} className="text-primary" />
              <h2 className="text-lg font-semibold">Configuração</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="interval" className="text-sm text-gray-300">
                Tocar vinheta a cada
              </label>
              <input
                id="interval"
                type="number"
                min={1}
                max={100}
                value={jingleInterval}
                onChange={(e) => setJingleInterval(Number(e.target.value))}
                className="w-20 px-3 py-1.5 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center"
              />
              <span className="text-sm text-gray-300">músicas</span>
              {jingleInterval !== savedInterval && (
                <button
                  type="button"
                  onClick={handleSaveInterval}
                  disabled={savingInterval}
                  className="px-4 py-1.5 bg-primary text-background rounded-md hover:bg-primary/80 transition-colors text-sm disabled:opacity-50"
                >
                  {savingInterval ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              {total} vinheta{total !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-md hover:bg-primary/80 transition-colors text-sm"
            >
              <Plus size={16} />
              Adicionar Vinheta
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : jingleList.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhuma vinheta cadastrada</p>
              <p className="text-sm mt-1">
                Clique em &quot;Adicionar Vinheta&quot; para começar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary/30 text-left text-sm text-gray-400">
                    <th className="pb-3 pr-4">Título</th>
                    <th className="pb-3 pr-4">Arquivo</th>
                    <th className="pb-3 pr-4">Duração</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {jingleList.map((jingle) => (
                    <tr
                      key={jingle.id}
                      className="border-b border-primary/10 hover:bg-primary/5 transition-colors"
                    >
                      <td className="py-3 pr-4 font-medium">{jingle.title}</td>
                      <td className="py-3 pr-4 text-sm text-gray-400">
                        {jingle.filename}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-400">
                        {formatDuration(jingle.duration)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            jingle.active === 1
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {jingle.active === 1 ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handlePlay(jingle)}
                            className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                            title={
                              playingId === jingle.id ? "Pausar" : "Reproduzir"
                            }
                          >
                            {playingId === jingle.id ? (
                              <Pause size={16} />
                            ) : (
                              <Play size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleActive(jingle.id, jingle.active)
                            }
                            className={`p-1.5 transition-colors ${
                              jingle.active === 1
                                ? "text-green-400 hover:text-red-400"
                                : "text-red-400 hover:text-green-400"
                            }`}
                            title={jingle.active === 1 ? "Desativar" : "Ativar"}
                          >
                            {jingle.active === 1 ? (
                              <Power size={16} />
                            ) : (
                              <PowerOff size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(jingle.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
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
            <div className="flex justify-center gap-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    p === page
                      ? "bg-primary text-background"
                      : "bg-background-alt text-gray-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background-alt border border-primary/30 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Adicionar Vinheta</h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="upload-title"
                  className="block text-sm mb-1 text-gray-300"
                >
                  Título
                </label>
                <input
                  id="upload-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ex: Vinheta de abertura"
                  className="w-full px-3 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="upload-file"
                  className="block text-sm mb-1 text-gray-300"
                >
                  Arquivo de áudio (MP3, WAV, OGG, M4A, AAC — máx 10MB)
                </label>
                <input
                  id="upload-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,.aac,audio/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-background"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadTitle("");
                  setUploadFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadTitle.trim() || !uploadFile}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-md hover:bg-primary/80 transition-colors text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
