"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Search, Music, Loader2, Download, Check, X } from "lucide-react";
import { toast } from "sonner";

interface DeezerResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

const MAX_DURATION_SECONDS = 10 * 60;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface DownloadProgress {
  trackId: string;
  progress: number;
  status: string;
  message: string;
}

export default function EnviarPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<DeezerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<DownloadProgress | null>(null);
  const [showForm, setShowForm] = useState<DeezerResult | null>(null);
  const [formData, setFormData] = useState({ title: "", artist: "" });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/deezer/search?q=${encodeURIComponent(searchQuery)}`,
      );
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setResults(data.results || []);
    } catch (error) {
      toast.error("Erro ao pesquisar");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleSelectVideo = (track: DeezerResult) => {
    setFormData({ title: track.title, artist: track.artist });
    setShowForm(track);
  };

  const handleDownload = async () => {
    if (!showForm || !formData.title.trim() || !formData.artist.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setDownloading({
      trackId: showForm.id,
      progress: 0,
      status: "starting",
      message: "Iniciando...",
    });
    setShowForm(null);

    try {
      const response = await fetch("/api/deezer/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: showForm.id,
          title: formData.title.trim(),
          artist: formData.artist.trim(),
          thumbnail: showForm.thumbnail,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                toast.error(data.error);
                setDownloading(null);
                return;
              }

              if (data.done) {
                toast.success(data.message || "Download concluído!");
                setDownloading(null);
                setResults([]);
                setSearchQuery("");
                return;
              }

              setDownloading((prev) => ({
                trackId: prev?.trackId || showForm.id,
                progress: data.progress || prev?.progress || 0,
                status: data.status || prev?.status || "",
                message: data.message || prev?.message || "",
              }));
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      toast.error("Erro no download");
      console.error(error);
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-primary mb-2">Enviar Música</h1>
        <p className="text-gray-400 mb-8">
          Pesquise uma música no Deezer e envie para a rádio
        </p>

        {/* Search Bar */}
        <div className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Pesquisar música no Deezer..."
              className="w-full pl-10 pr-4 py-3 bg-background-alt border border-primary/30 rounded-lg focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              "Buscar"
            )}
          </button>
        </div>

        {/* Download Progress */}
        {downloading && (
          <div className="mb-8 p-6 bg-background-alt border border-primary/30 rounded-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="animate-pulse">
                <Music className="text-primary" size={32} />
              </div>
              <div className="flex-1">
                <p className="font-medium">{downloading.message}</p>
                <p className="text-sm text-gray-400">{downloading.status}</p>
              </div>
              <span className="text-2xl font-bold text-primary">
                {downloading.progress}%
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${downloading.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && !downloading && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Resultados ({results.length})
            </h2>
            {results.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-4 bg-background-alt border border-primary/20 rounded-lg hover:border-primary/40 transition-colors"
              >
                <Image
                  src={track.thumbnail}
                  alt={track.title}
                  width={120}
                  height={68}
                  className="rounded object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{track.title}</h3>
                  <p className="text-sm text-gray-400 truncate">
                    {track.artist}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDuration(track.duration)}
                    {track.duration > MAX_DURATION_SECONDS && (
                      <span className="text-red-400 ml-2">
                        Excede o limite de 10 min
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleSelectVideo(track)}
                  disabled={track.duration > MAX_DURATION_SECONDS}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors shrink-0"
                >
                  <Download size={18} />
                  Baixar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && !downloading && (
          <div className="text-center py-16 text-gray-400">
            <Music className="mx-auto mb-4 opacity-50" size={48} />
            <p>Pesquise uma música para começar</p>
          </div>
        )}

        {/* Download Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-background-alt border border-primary/30 rounded-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold">Confirmar Download</h3>
                <button
                  onClick={() => setShowForm(null)}
                  className="p-1 hover:bg-background rounded"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                <Image
                  src={showForm.thumbnail}
                  alt={showForm.title}
                  width={120}
                  height={68}
                  className="rounded object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400 truncate">
                    {showForm.title}
                  </p>
                  <p className="text-xs text-gray-500">{showForm.artist}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label
                    htmlFor="artist"
                    className="block text-sm text-gray-400 mb-1"
                  >
                    Artista *
                  </label>
                  <input
                    id="artist"
                    type="text"
                    value={formData.artist}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, artist: e.target.value }))
                    }
                    className="w-full px-4 py-2 bg-background border border-primary/30 rounded-lg focus:outline-none focus:border-primary"
                    placeholder="Nome do artista"
                  />
                </div>
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm text-gray-400 mb-1"
                  >
                    Título da Música *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full px-4 py-2 bg-background border border-primary/30 rounded-lg focus:outline-none focus:border-primary"
                    placeholder="Título da música"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(null)}
                  className="flex-1 px-4 py-2 border border-gray-600 hover:bg-background rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!formData.title.trim() || !formData.artist.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  <Check size={18} />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
