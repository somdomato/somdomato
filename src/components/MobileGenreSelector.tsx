"use client";

import { useState, useCallback } from "react";
import { Radio } from "lucide-react";
import { useGenre, GENRES } from "@/context/GenreContext";
import { useAudio } from "@/context/AudioContext";
import { buildStreamUrl, RADIO_CONFIG } from "@/config";
import { toast } from "sonner";

export default function MobileGenreSelector() {
  const { currentGenre, setGenre } = useGenre();
  const { play, setSong } = useAudio();
  const [showDropdown, setShowDropdown] = useState(false);

  const currentGenreLabel =
    GENRES.find((g) => g.value === currentGenre)?.label || "Geral";

  const handleGenreChange = useCallback(
    async (newGenre: (typeof GENRES)[number]) => {
      setGenre(newGenre.value);
      setShowDropdown(false);

      const streamUrl = buildStreamUrl(newGenre.mountpoint);
      await play(streamUrl);

      try {
        const response = await fetch(`/api/metadata?genre=${newGenre.value}`);
        if (response.ok) {
          const data = await response.json();
          if (data.song) setSong(data.song);
        }
      } catch (error) {
        console.error("Erro ao buscar metadados:", error);
      }

      toast.success(`Estação: ${newGenre.label}`);
    },
    [setGenre, play, setSong],
  );

  if (!RADIO_CONFIG.multipleMounts) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 transition-all group"
        title="Trocar estação"
      >
        <Radio
          size={14}
          className="text-primary group-hover:scale-110 transition-transform"
        />
        <span className="text-xs font-medium text-white max-w-20 truncate">
          {currentGenreLabel}
        </span>
        <svg
          className={`w-3 h-3 text-primary/70 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
            aria-label="Fechar"
          />
          <div className="absolute left-0 min-w-40 top-full mt-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-1 space-y-0.5">
              {GENRES.map((genre) => (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => handleGenreChange(genre)}
                  className={`w-full px-2.5 py-2 text-left text-[11px] rounded-md transition-colors flex items-center gap-2 ${currentGenre === genre.value ? "bg-white/10 text-white font-medium" : "text-white/60 hover:text-white hover:bg-white/6"}`}
                >
                  <Radio
                    size={11}
                    className={`shrink-0 ${
                      currentGenre === genre.value
                        ? "text-primary"
                        : "text-white/30"
                    }`}
                  />
                  <span>{genre.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
