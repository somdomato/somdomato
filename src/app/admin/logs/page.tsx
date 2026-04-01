"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  Music,
  ListOrdered,
  Upload,
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Trash2,
  Check,
  X,
  SkipForward,
  UserPlus,
  LogIn,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";

interface LogItem {
  id: number;
  action: string;
  details: Record<string, unknown> | null;
  targetType: string | null;
  targetId: number | null;
  ip: string | null;
  createdAt: string | null;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof Check; color: string }
> = {
  "upload:created": {
    label: "Upload criado",
    icon: Upload,
    color: "text-blue-400",
  },
  "upload:approved": {
    label: "Upload aprovado",
    icon: Check,
    color: "text-green-400",
  },
  "upload:rejected": {
    label: "Upload rejeitado",
    icon: X,
    color: "text-red-400",
  },
  "upload:deleted": {
    label: "Upload deletado",
    icon: Trash2,
    color: "text-red-400",
  },
  "upload:ai_approved": {
    label: "IA aprovou",
    icon: Sparkles,
    color: "text-purple-400",
  },
  "upload:ai_kept": {
    label: "IA mantida",
    icon: Check,
    color: "text-purple-400",
  },
  "upload:ai_rejected": {
    label: "IA rejeitada",
    icon: X,
    color: "text-orange-400",
  },
  "upload:ai_deleted": {
    label: "IA deletada",
    icon: Trash2,
    color: "text-orange-400",
  },
  "song:created": {
    label: "Música criada",
    icon: Music,
    color: "text-green-400",
  },
  "song:updated": {
    label: "Música atualizada",
    icon: Music,
    color: "text-blue-400",
  },
  "song:deleted": {
    label: "Música deletada",
    icon: Trash2,
    color: "text-red-400",
  },
  "request:added": {
    label: "Pedido adicionado",
    icon: ListOrdered,
    color: "text-green-400",
  },
  "request:removed": {
    label: "Pedido removido",
    icon: Trash2,
    color: "text-red-400",
  },
  "request:reordered": {
    label: "Pedido reordenado",
    icon: ListOrdered,
    color: "text-blue-400",
  },
  "admin:skip": {
    label: "Skip enviado",
    icon: SkipForward,
    color: "text-yellow-400",
  },
  "admin:login": { label: "Login", icon: LogIn, color: "text-green-400" },
  "admin:logout": { label: "Logout", icon: LogIn, color: "text-gray-400" },
  "user:request": {
    label: "Pedido do usuário",
    icon: UserPlus,
    color: "text-blue-400",
  },
  "user:upload": {
    label: "Upload do usuário",
    icon: Upload,
    color: "text-blue-400",
  },
};

const ACTION_GROUPS = [
  { value: "", label: "Todas" },
  { value: "upload", label: "Uploads" },
  { value: "song", label: "Músicas" },
  { value: "request", label: "Pedidos" },
  { value: "admin", label: "Admin" },
  { value: "user", label: "Usuários" },
];

function formatLogDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return "agora";
  if (diff < 3600000) return `há ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `há ${Math.floor(diff / 3600000)}h`;

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      setLogs(data.items || []);
      setPages(data.pages || 0);
      setTotal(data.total || 0);
    } catch {
      toast.error("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
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
              <ScrollText size={18} />
              <span className="hidden sm:inline">Logs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Action filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {ACTION_GROUPS.map((group) => (
              <button
                key={group.value}
                onClick={() => {
                  setActionFilter(group.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  actionFilter === group.value
                    ? "bg-primary text-white"
                    : "bg-background-alt text-gray-400 hover:text-white border border-primary/10"
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 sm:ml-auto">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar nos logs..."
                className="w-full pl-8 pr-3 py-1.5 bg-background-alt border border-primary/20 rounded-lg text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
            >
              <Filter size={14} />
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="text-xs text-gray-500 mb-3">
          {total} registro{total !== 1 ? "s" : ""} encontrado
          {total !== 1 ? "s" : ""}
        </div>

        {/* Logs list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ScrollText className="mx-auto mb-4 opacity-50" size={48} />
            <p>Nenhum log encontrado</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => {
              const config = ACTION_CONFIG[log.action] || {
                label: log.action,
                icon: Clock,
                color: "text-gray-400",
              };
              const Icon = config.icon;
              const details = log.details || {};

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-3 py-2.5 bg-background-alt/50 rounded-lg border border-primary/5 hover:border-primary/15 transition-colors"
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg bg-black/20 ${config.color}`}
                  >
                    <Icon size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {log.targetId && (
                        <span className="text-xs text-gray-500">
                          #{log.targetId}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    {details && Object.keys(details).length > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {(() => {
                          const d = details as Record<string, unknown>;
                          if (d.title) {
                            return (
                              <span>
                                {String(d.title)}
                                {d.artist ? ` — ${String(d.artist)}` : null}
                              </span>
                            );
                          }
                          if (d.reason) {
                            return <span>({String(d.reason)})</span>;
                          }
                          return (
                            <span>{JSON.stringify(details).slice(0, 100)}</span>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">
                      {formatLogDate(log.createdAt)}
                    </div>
                    {log.ip && (
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {log.ip}
                      </div>
                    )}
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
    </div>
  );
}
