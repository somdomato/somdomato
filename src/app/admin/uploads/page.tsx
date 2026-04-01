"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  ListOrdered,
  Upload,
  ScrollText,
  Check,
  X,
  Trash2,
  ExternalLink,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  Bot,
  Shield,
  Timer,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";
import { GENRES } from "@/config";
import { socket } from "@/lib/socket";

interface UploadItem {
  id: number;
  title: string;
  artist: string;
  deezerUrl: string;
  deezerId: string;
  thumbnail: string | null;
  filename: string;
  duration: number | null;
  deezerGenre: string | null;
  status: string;
  autoApproved: number | null;
  autoApproveAt: string | null;
  autoApproveGenre: string | null;
  aiReason: string | null;
  createdAt: Date | null;
}

type FilterTab = "pending" | "ai_approved" | "approved" | "rejected";

const FILTER_TABS: { value: FilterTab; label: string; icon: typeof Upload }[] =
  [
    { value: "pending", label: "Pendentes", icon: Clock },
    { value: "ai_approved", label: "Inteligência Artificial", icon: Sparkles },
    { value: "approved", label: "Aprovados", icon: Check },
    { value: "rejected", label: "Rejeitados", icon: X },
  ];

const TIME_SLOT_OPTIONS = [
  { bit: 1, label: "Madrugada", sub: "00h–06h" },
  { bit: 2, label: "Manhã", sub: "06h–12h" },
  { bit: 4, label: "Tarde", sub: "12h–18h" },
  { bit: 8, label: "Noite", sub: "18h–00h" },
];

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [processing, setProcessing] = useState<number | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<UploadItem | null>(
    null,
  );
  const [selectedGenre, setSelectedGenre] = useState("geral");
  const [selectedRotation, setSelectedRotation] = useState("normal");
  const [selectedTimeSlots, setSelectedTimeSlots] = useState(15);
  const [now, setNow] = useState(Date.now());
  const [aiAction, setAiAction] = useState<"approve" | "ai_keep">("approve");

  // Tick every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/uploads?status=${filter}&page=${page}&limit=20`,
      );
      const data = await res.json();
      setUploads(data.items || []);
      setPages(data.pages || 0);
    } catch {
      toast.error("Erro ao carregar envios");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  // Listen for AI approval events
  useEffect(() => {
    const onAiApproved = () => {
      if (filter === "pending" || filter === "ai_approved") {
        loadUploads();
      }
    };
    socket.on("upload:ai_approved", onAiApproved);
    return () => {
      socket.off("upload:ai_approved", onAiApproved);
    };
  }, [filter, loadUploads]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const openApproveModal = (
    upload: UploadItem,
    action: "approve" | "ai_keep",
  ) => {
    setShowApproveModal(upload);
    setAiAction(action);
    setSelectedGenre(upload.autoApproveGenre || "geral");
    setSelectedRotation("normal");
    setSelectedTimeSlots(15);
  };

  const confirmApprove = async () => {
    if (!showApproveModal) return;

    setProcessing(showApproveModal.id);
    try {
      const res = await fetch(`/api/admin/uploads/${showApproveModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: aiAction,
          genre: selectedGenre,
          rotation: selectedRotation,
          timeSlots: selectedTimeSlots,
        }),
      });

      if (!res.ok) throw new Error("Failed to approve");

      toast.success("Música aprovada e adicionada à biblioteca!");
      setShowApproveModal(null);
      loadUploads();
    } catch {
      toast.error("Erro ao aprovar música");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number, isAi = false) => {
    if (!confirm("Tem certeza que deseja rejeitar este envio?")) return;

    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/uploads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isAi ? "ai_reject" : "reject" }),
      });

      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Envio rejeitado");
      loadUploads();
    } catch {
      toast.error("Erro ao rejeitar envio");
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
    } catch {
      toast.error("Erro ao deletar envio");
    } finally {
      setProcessing(null);
    }
  };

  const toggleTimeSlot = (bit: number) => {
    setSelectedTimeSlots((prev) => prev ^ bit);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getCountdown = (autoApproveAt: string | null) => {
    if (!autoApproveAt) return null;
    const remaining = Math.max(
      0,
      Math.ceil((new Date(autoApproveAt).getTime() - now) / 1000),
    );
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return { remaining, display: `${m}:${String(s).padStart(2, "0")}` };
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

      {/* Navigation Tabs */}
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
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 border-primary text-primary whitespace-nowrap text-sm">
              <Upload size={18} />
              <span className="hidden sm:inline">Envios</span>
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
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setFilter(tab.value);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  filter === tab.value
                    ? tab.value === "ai_approved"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                      : "bg-primary text-white shadow-lg shadow-primary/20"
                    : "bg-background-alt text-gray-400 hover:text-white border border-primary/10"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* AI Tab Header */}
        {filter === "ai_approved" && (
          <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl flex items-start gap-3">
            <Bot size={20} className="text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-300">
                Aprovações da Inteligência Artificial
              </p>
              <p className="text-xs text-purple-400/70 mt-0.5">
                Músicas aprovadas automaticamente pela IA. Revise e decida:
                manter, rejeitar ou apagar.
              </p>
            </div>
          </div>
        )}

        {/* Cards List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Upload className="mx-auto mb-4 opacity-50" size={48} />
            <p className="text-sm">Nenhum envio encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((upload) => {
              const countdown = getCountdown(upload.autoApproveAt);
              const isAiTab = filter === "ai_approved";

              return (
                <div
                  key={upload.id}
                  className={`bg-background-alt rounded-xl border transition-all ${
                    isAiTab
                      ? "border-purple-500/20 hover:border-purple-500/40"
                      : "border-primary/10 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Thumbnail */}
                    <div className="shrink-0">
                      {upload.thumbnail ? (
                        <Image
                          src={upload.thumbnail}
                          alt={upload.title}
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center">
                          <Music size={20} className="text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {upload.title}
                        </span>

                        {/* Badges */}
                        {upload.status === "ai_approved" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/50 text-purple-300 border border-purple-700/50">
                            <Sparkles size={10} />
                            IA
                          </span>
                        )}
                        {upload.autoApproved === 1 &&
                          upload.status === "approved" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-900/50 text-green-400 border border-green-700/50">
                              Auto
                            </span>
                          )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 truncate">
                          {upload.artist}
                        </span>
                        {upload.duration && (
                          <span className="text-[10px] text-gray-500">
                            {formatDuration(upload.duration)}
                          </span>
                        )}
                        {upload.deezerGenre && (
                          <span className="text-[10px] text-gray-500 hidden sm:inline">
                            {upload.deezerGenre}
                          </span>
                        )}
                      </div>

                      {/* Countdown */}
                      {countdown &&
                        upload.status === "pending" &&
                        countdown.remaining > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Timer size={12} className="text-yellow-400" />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-yellow-400/70">
                                Auto-aprovação em
                              </span>
                              <span className="text-xs font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                                {countdown.display}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="flex-1 h-1 bg-yellow-900/30 rounded-full overflow-hidden max-w-20">
                              <div
                                className="h-full bg-yellow-400/60 rounded-full transition-all"
                                style={{
                                  width: `${Math.max(0, 100 - (countdown.remaining / 300) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                      {/* Countdown done */}
                      {countdown &&
                        upload.status === "pending" &&
                        countdown.remaining === 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Sparkles
                              size={12}
                              className="text-green-400 animate-pulse"
                            />
                            <span className="text-[10px] text-green-400">
                              Aprovando...
                            </span>
                          </div>
                        )}

                      {/* AI Reason */}
                      {upload.aiReason && isAiTab && (
                        <div className="flex items-center gap-1 mt-1">
                          <Bot size={10} className="text-purple-400/60" />
                          <span className="text-[10px] text-purple-400/60 truncate">
                            {upload.aiReason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={upload.deezerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                        title="Ver no Deezer"
                      >
                        <ExternalLink size={14} />
                      </a>

                      {filter === "pending" && (
                        <>
                          <button
                            onClick={() => openApproveModal(upload, "approve")}
                            disabled={processing === upload.id}
                            className="p-2 text-green-400 hover:bg-green-500/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="Aprovar"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleReject(upload.id)}
                            disabled={processing === upload.id}
                            className="p-2 text-red-400 hover:bg-red-500/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="Rejeitar"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}

                      {filter === "ai_approved" && (
                        <>
                          <button
                            onClick={() => openApproveModal(upload, "ai_keep")}
                            disabled={processing === upload.id}
                            className="p-2 text-green-400 hover:bg-green-500/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="Manter aprovação"
                          >
                            <Shield size={16} />
                          </button>
                          <button
                            onClick={() => handleReject(upload.id, true)}
                            disabled={processing === upload.id}
                            className="p-2 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 rounded-lg transition-colors"
                            title="Rejeitar aprovação"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDelete(upload.id)}
                        disabled={processing === upload.id}
                        className="p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-background-alt disabled:opacity-30 hover:bg-primary/20 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-400">
              {page} / {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-2 rounded-lg bg-background-alt disabled:opacity-30 hover:bg-primary/20 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* Approve Modal */}
      {showApproveModal && (
        <button
          type="button"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setShowApproveModal(null)
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowApproveModal(null);
          }}
        >
          <div className="bg-background-alt border border-primary/30 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-4 border-b border-primary/20 shrink-0">
              {showApproveModal.thumbnail ? (
                <Image
                  src={showApproveModal.thumbnail}
                  alt={showApproveModal.title}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center">
                  <Music size={20} className="text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate m-0">
                  {aiAction === "ai_keep"
                    ? "Manter Aprovação IA"
                    : "Aprovar Música"}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  {showApproveModal.title} — {showApproveModal.artist}
                </p>
              </div>
              <button
                onClick={() => setShowApproveModal(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* AI Reason */}
              {showApproveModal.aiReason && (
                <div className="p-2.5 bg-purple-900/20 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot size={12} className="text-purple-400" />
                    <span className="text-[10px] font-medium text-purple-300 uppercase tracking-wider">
                      Avaliação da IA
                    </span>
                  </div>
                  <p className="text-xs text-purple-300/80">
                    {showApproveModal.aiReason}
                  </p>
                </div>
              )}

              {/* Genre */}
              <fieldset>
                <legend className="block text-xs font-medium text-gray-400 mb-1.5">
                  Gênero
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setSelectedGenre(g.value)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedGenre === g.value
                          ? "bg-primary text-white shadow-md"
                          : "bg-background text-gray-400 hover:text-white border border-primary/10"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Rotation */}
              <fieldset>
                <legend className="block text-xs font-medium text-gray-400 mb-1.5">
                  Rotação
                </legend>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { value: "inativo", label: "Inativo", desc: "Não toca" },
                    { value: "leve", label: "Leve", desc: "Toca pouco" },
                    { value: "normal", label: "Normal", desc: "Padrão" },
                    { value: "pesado", label: "Pesado", desc: "Toca mais" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedRotation(opt.value)}
                      className={`px-2 py-2 rounded-lg text-center transition-all ${
                        selectedRotation === opt.value
                          ? "bg-primary text-white shadow-md"
                          : "bg-background text-gray-400 hover:text-white border border-primary/10"
                      }`}
                    >
                      <span className="text-xs font-medium block">
                        {opt.label}
                      </span>
                      <span className="text-[10px] opacity-60">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Time Slots */}
              <fieldset>
                <legend className="block text-xs font-medium text-gray-400 mb-1.5">
                  Horários Permitidos
                </legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIME_SLOT_OPTIONS.map(({ bit, label, sub }) => (
                    <button
                      key={bit}
                      type="button"
                      onClick={() => toggleTimeSlot(bit)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                        (selectedTimeSlots & bit) !== 0
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "bg-background text-gray-400 border border-primary/10"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                          (selectedTimeSlots & bit) !== 0
                            ? "bg-primary border-primary"
                            : "border-gray-600"
                        }`}
                      >
                        {(selectedTimeSlots & bit) !== 0 && (
                          <Check size={8} className="text-white" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-medium block">
                          {label}
                        </span>
                        <span className="text-[10px] opacity-60">{sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Song info summary */}
              <div className="p-2.5 bg-background/50 rounded-lg space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Duração</span>
                  <span>{formatDuration(showApproveModal.duration)}</span>
                </div>
                {showApproveModal.deezerGenre && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Gênero (Deezer)</span>
                    <span>{showApproveModal.deezerGenre}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Deezer</span>
                  <a
                    href={showApproveModal.deezerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex items-center gap-1"
                  >
                    Abrir <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-2 p-4 border-t border-primary/20 shrink-0">
              <button
                onClick={() => setShowApproveModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-600 hover:bg-background rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmApprove}
                disabled={processing === showApproveModal.id}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} />
                {aiAction === "ai_keep" ? "Manter" : "Aprovar"}
              </button>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
