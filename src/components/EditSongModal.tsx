"use client";

import { useState } from "react";
import { updateSong, type RotationType } from "@/actions/admin";
import { X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string | null;
  path: string;
  cover: string | null;
  timeSlots: number | null;
  rotation: string | null;
}

interface EditSongModalProps {
  song: Song;
  onClose: () => void;
  onSave: () => void;
  onCoverReset?: () => void; // chamado quando a capa for resetada sem fechar o modal
}

export function EditSongModal({ song, onClose, onSave, onCoverReset }: EditSongModalProps) {
  const [formData, setFormData] = useState({
    filename: song.path.split("/").pop() || "",
    title: song.title,
    artist: song.artist,
    album: song.album || "",
    rotation: song.rotation || "normal",
    timeSlots: song.timeSlots || 15,
    coverFile: "",
  });
  const [saving, setSaving] = useState(false);
  const [displayedCover, setDisplayedCover] = useState<string>(song.cover || "/images/logotipo.svg");
  const [coverWasReset, setCoverWasReset] = useState(false); // marca que a capa foi resetada no modal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await updateSong(song.id, {
        filename: formData.filename,
        title: formData.title,
        artist: formData.artist,
        album: formData.album,
        rotation: formData.rotation as RotationType,
        timeSlots: formData.timeSlots,
        coverFile: formData.coverFile || undefined,
        resetCover: coverWasReset,
      });

      // Atualizar preview com valor retornado pelo servidor (garante sincronização)
      const newCover = res?.song?.cover || "/images/logotipo.svg";
      setDisplayedCover(newCover);
      setCoverWasReset(false);

      toast.success("Música atualizada com sucesso!");
      onSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar música";
      toast.error(message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleTimeSlot = (bit: number) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots ^ bit,
    }));
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    // Converter para base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        coverFile: reader.result as string,
      }));
      setDisplayedCover(reader.result as string);
      setCoverWasReset(false);
    };
    reader.readAsDataURL(file);
  };

  const handleResetCover = async () => {
    if (displayedCover === "/images/logotipo.svg") return;
    setSaving(true);
    try {
      const res = await updateSong(song.id, { resetCover: true });
      const newCover = res?.song?.cover || "/images/logotipo.svg";
      setDisplayedCover(newCover);
      setCoverWasReset(true);
      toast.success("Capa resetada para o padrão");
      // não fechar o modal — apenas avisar que a capa foi resetada para permitir reload na tabela
      onCoverReset?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao resetar capa";
      toast.error(message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-alt rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-primary/30">
          <h2 className="text-xl font-bold text-primary">Editar Música</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Capa */}
          <div className="flex flex-col items-center">
            <Image src={displayedCover} alt={song.title} width={128} height={128} className="w-32 h-32 object-cover rounded-lg" />
            <button type="button" onClick={handleResetCover} disabled={displayedCover === "/images/logotipo.svg" || saving} className="mt-2 px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50">
              Apagar capa
            </button>
          </div>

          {/* Nome do Arquivo */}
          <div>
            <label htmlFor="filename" className="block text-sm font-medium mb-2">
              Nome do Arquivo
            </label>
            <input id="filename" type="text" value={formData.filename} onChange={(e) => setFormData((prev) => ({ ...prev, filename: e.target.value }))} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Título */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Título (ID3)
            </label>
            <input id="title" type="text" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>

          {/* Artista */}
          <div>
            <label htmlFor="artist" className="block text-sm font-medium mb-2">
              Artista (ID3)
            </label>
            <input id="artist" type="text" value={formData.artist} onChange={(e) => setFormData((prev) => ({ ...prev, artist: e.target.value }))} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>

          {/* Álbum */}
          <div>
            <label htmlFor="album" className="block text-sm font-medium mb-2">
              Álbum (ID3)
            </label>
            <input id="album" type="text" value={formData.album} onChange={(e) => setFormData((prev) => ({ ...prev, album: e.target.value }))} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Upload de Capa */}
          <div>
            <label htmlFor="coverUpload" className="block text-sm font-medium mb-2">
              Atualizar Capa Embutida (ID3)
            </label>
            <input
              id="coverUpload"
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-background hover:file:bg-primary/80"
            />
            <p className="text-xs text-gray-400 mt-1">A imagem será embutida no arquivo MP3 (máximo 2MB)</p>
            {formData.coverFile && (
              <div className="mt-2">
                <Image src={formData.coverFile} alt="Preview" width={128} height={128} className="w-32 h-32 object-cover rounded" />
                <p className="text-xs text-green-400 mt-1">Nova capa selecionada</p>
              </div>
            )}
          </div>

          {/* Rotação */}
          <div>
            <label htmlFor="rotation" className="block text-sm font-medium mb-2">
              Rotação
            </label>
            <select id="rotation" value={formData.rotation} onChange={(e) => setFormData((prev) => ({ ...prev, rotation: e.target.value }))} className="w-full px-4 py-2 bg-background border border-primary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="inativo">Inativo (não toca automaticamente)</option>
              <option value="leve">Leve (toca menos)</option>
              <option value="normal">Normal</option>
              <option value="pesado">Pesado (toca mais)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Define a frequência que a música toca na rotação automática</p>
          </div>

          {/* Time Slots */}
          <div>
            <label htmlFor="timeSlots" className="block text-sm font-medium mb-2">
              Horários Permitidos
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { bit: 1, label: "Madrugada (00:00 - 06:00)" },
                { bit: 2, label: "Manhã (06:00 - 12:00)" },
                { bit: 4, label: "Tarde (12:00 - 18:00)" },
                { bit: 8, label: "Noite (18:00 - 00:00)" },
              ].map(({ bit, label }) => (
                <label key={bit} className="flex items-center gap-2 p-2 bg-background rounded cursor-pointer hover:bg-background/80 transition-colors">
                  <input type="checkbox" checked={(formData.timeSlots & bit) !== 0} onChange={() => toggleTimeSlot(bit)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-background border border-primary/30 rounded-md hover:bg-background/80 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
