"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getDuplicateSongs, type DuplicateGroup } from "@/actions/admin";

async function apiDeleteSong(id: number) {
  const res = await fetch(`/api/admin/songs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("failed to delete");
  return res.json();
}

export function DuplicatesPanel() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDuplicateSongs();
      setGroups(data);
    } catch {
      toast.error("Erro ao carregar duplicatas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Deletar "${title}"?`)) return;
    setDeleting(id);
    try {
      await apiDeleteSong(id);
      toast.success(`"${title}" deletada`);
      await load();
    } catch {
      toast.error("Erro ao deletar música");
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteGroup = async (group: DuplicateGroup) => {
    const toDelete = group.songs.filter((s) => !s.recommended);
    if (
      !confirm(
        `Deletar ${toDelete.length} duplicata(s) de "${group.songs[0].title}"?`,
      )
    )
      return;

    for (const s of toDelete) {
      setDeleting(s.id);
      try {
        await apiDeleteSong(s.id);
      } catch {
        toast.error(`Erro ao deletar "${s.title}"`);
      }
    }
    setDeleting(null);
    toast.success("Duplicatas removidas");
    await load();
  };

  const handleDeleteAll = async () => {
    const total = groups.reduce(
      (sum, g) => sum + g.songs.filter((s) => !s.recommended).length,
      0,
    );
    if (
      !confirm(
        `Deletar todas as ${total} duplicatas? Apenas a versão recomendada de cada grupo será mantida.`,
      )
    )
      return;

    for (const group of groups) {
      for (const s of group.songs.filter((s) => !s.recommended)) {
        setDeleting(s.id);
        try {
          await apiDeleteSong(s.id);
        } catch {
          toast.error(`Erro ao deletar "${s.title}"`);
        }
      }
    }
    setDeleting(null);
    toast.success("Todas as duplicatas removidas");
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        Analisando músicas...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <ShieldCheck size={40} className="text-green-400" />
        <p className="text-lg font-semibold text-green-400">
          Nenhuma duplicata encontrada
        </p>
        <p className="text-sm">Todas as músicas são únicas no catálogo.</p>
        <button
          onClick={load}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-primary/10 text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Verificar novamente
        </button>
      </div>
    );
  }

  const totalDuplicates = groups.reduce(
    (sum, g) => sum + g.songs.filter((s) => !s.recommended).length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <span className="font-bold text-primary">{groups.length}</span> grupos
          com duplicatas —{" "}
          <span className="font-bold text-red-400">{totalDuplicates}</span>{" "}
          músicas redundantes
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 bg-background border border-primary/30 rounded-md hover:bg-primary/10 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleting !== null}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 border border-red-500/40 text-red-400 hover:bg-red-900/60 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            Remover todas as duplicatas
          </button>
        </div>
      </div>

      {/* Grupos */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.key}
            className="bg-background-alt rounded-lg border border-primary/20 overflow-hidden"
          >
            {/* Cabeçalho do grupo */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10 bg-primary/5">
              <span className="text-sm font-semibold text-primary">
                {group.songs[0].artist} — {group.songs[0].title}
              </span>
              <button
                onClick={() => handleDeleteGroup(group)}
                disabled={deleting !== null}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={12} />
                Remover duplicatas do grupo
              </button>
            </div>

            {/* Músicas do grupo */}
            <div className="divide-y divide-primary/10">
              {group.songs.map((song) => (
                <div
                  key={song.id}
                  className={`flex items-center gap-4 px-4 py-3 ${
                    song.recommended ? "bg-green-900/10" : "bg-red-900/5"
                  }`}
                >
                  <Image
                    src={song.cover || "/images/logotipo.svg"}
                    alt={song.title}
                    width={40}
                    height={40}
                    className="rounded object-cover shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {song.artist}
                    </p>
                    <p className="text-xs text-gray-500 truncate font-mono mt-0.5">
                      {song.path.split("/").pop()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
                    <span
                      className="px-2 py-0.5 rounded bg-primary/20 text-primary"
                      title="Gênero"
                    >
                      {song.genre || "geral"}
                    </span>
                    <span title="Pedidos">{song.requests ?? 0} pedidos</span>
                  </div>

                  <div className="shrink-0">
                    {song.recommended ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 font-semibold px-2 py-1 bg-green-900/20 rounded">
                        <ShieldCheck size={12} />
                        Manter
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(song.id, song.title)}
                        disabled={deleting !== null}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/20 hover:bg-red-900/40 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Deletar esta duplicata"
                      >
                        {deleting === song.id ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <>
                            <Trash2 size={12} />
                            Deletar
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
