"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import type { Song } from "@/types/song";

export default function AdminSongEditor({ song }: { song: Song }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title || "");
  const [artist, setArtist] = useState(song.artist || "");
  const [newFileName, setNewFileName] = useState(
    (song.path || "").split("/").pop() || "",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

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
        setMessage("Tags atualizadas.");
        router.refresh();
      } else {
        setMessage(json.error || "Erro ao atualizar tags");
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro ao atualizar tags");
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
        body: JSON.stringify({ id: song.id, newFileName }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage("Arquivo renomeado.");
        router.refresh();
      } else {
        setMessage(json.error || "Erro ao renomear o arquivo");
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro ao renomear o arquivo");
    } finally {
      setLoading(false);
    }
  }

  function handleRenameClick() {
    // Show a confirmation modal with preview
    setShowConfirm(true);
  }

  return (
    <div className="mt-2">
      <button
        className="px-2 py-1 bg-gray-200 rounded-md"
        onClick={() => setEditing(!editing)}
      >
        {editing ? "Fechar" : "Editar"}
      </button>
      {editing && (
        <div className="mt-2 p-2 border rounded">
          <label htmlFor={`title_${song.id}`} className="block text-sm">
            Título
          </label>
          <input
            id={`title_${song.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border p-1 rounded mb-2"
          />
          <label htmlFor={`artist_${song.id}`} className="block text-sm">
            Artista
          </label>
          <input
            id={`artist_${song.id}`}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full border p-1 rounded mb-2"
          />

          <button
            disabled={loading}
            onClick={saveTags}
            className="px-2 py-1 bg-blue-600 text-white rounded mr-2"
          >
            Salvar Tags
          </button>

          <label htmlFor={`file_${song.id}`} className="block text-sm mt-4">
            Renomear arquivo
          </label>
          <input
            id={`file_${song.id}`}
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="w-full border p-1 rounded mb-2"
          />
          <div className="text-xs text-gray-500">
            Preview: <code>{`/music/${newFileName}`}</code>
          </div>
          <button
            disabled={loading}
            onClick={handleRenameClick}
            className="px-2 py-1 bg-green-600 text-white rounded"
          >
            Renomear
          </button>

          {message && <p className="mt-2 text-sm">{message}</p>}
          {showConfirm && (
            <Modal>
              <h3 id="modalTitle" className="text-lg font-semibold">
                Confirmar renomeação
              </h3>
              <p className="mt-2">
                Antigo: <code>{song.path}</code>
              </p>
              <p className="mt-2">
                Novo: <code>{`/music/${newFileName}`}</code>
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={async () => {
                    await renameFile();
                    setShowConfirm(false);
                  }}
                  className="px-2 py-1 bg-green-600 text-white rounded"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-2 py-1 bg-gray-200 rounded"
                >
                  Cancelar
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}
