"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Song } from "@/types/song";
import { useRouter } from "next/navigation";

export default function EditableSongRow({
  song,
  onUpdated,
}: {
  song: Song;
  onUpdated?: (s: Partial<Song>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title || "");
  const [artist, setArtist] = useState(song.artist || "");
  const [fileName, setFileName] = useState(
    (song.path || "").split("/").pop() || "",
  );
  const [pathState, setPathState] = useState(song.path || "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function saveTags() {
    setLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? (localStorage.getItem("adminToken") ?? undefined)
          : undefined;
      const res = await fetch("/api/admin/id3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ id: song.id, tags: { title, artist } }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Tags atualizadas");
        setEditing(false);
        onUpdated?.({ title, artist });
        // update other clients via refresh if needed
        router.refresh();
      } else {
        toast.error(json.error || "Erro ao atualizar tags");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar tags");
    } finally {
      setLoading(false);
    }
  }

  async function renameFile() {
    setLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? (localStorage.getItem("adminToken") ?? undefined)
          : undefined;
      const res = await fetch("/api/admin/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ id: song.id, newFileName: fileName }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Arquivo renomeado");
        onUpdated?.({ path: json.path });
        if (json.path) setPathState(json.path);
        // Refresh so other data (e.g., path) shows up
        router.refresh();
      } else {
        toast.error(json.error || "Erro ao renomear arquivo");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao renomear arquivo");
    } finally {
      setLoading(false);
    }
  }

  const buttonClass =
    "px-2 py-1 rounded text-white border-2 border-[#6b4f3a] bg-black hover:bg-green-700";

  return (
    <div className="py-2 border-b flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="min-w-0">
            {editing ? (
              <input
                className="w-full border p-1 rounded bg-[#111] text-white"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            ) : (
              <div className="font-medium text-white">
                {title || song.title}
              </div>
            )}
            {editing ? (
              <input
                className="w-full border p-1 rounded bg-[#111] text-white mt-1"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
              />
            ) : (
              <div className="text-sm text-gray-300">
                {artist || song.artist}
              </div>
            )}
            {editing ? (
              <input
                className="w-full border p-1 rounded bg-[#111] text-white mt-1"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            ) : (
              <div className="text-xs text-gray-400 mt-1">{pathState}</div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 items-start">
        {editing ? (
          <>
            <button
              className={buttonClass}
              disabled={loading}
              onClick={saveTags}
            >
              Salvar
            </button>
            <button
              className={buttonClass}
              disabled={loading}
              onClick={renameFile}
            >
              Renomear
            </button>
            <button
              className="px-2 py-1 rounded bg-[#2a2a2a] text-white border-2 border-[#6b4f3a] hover:bg-green-700"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button className={buttonClass} onClick={() => setEditing(true)}>
            Editar
          </button>
        )}
      </div>
    </div>
  );
}
