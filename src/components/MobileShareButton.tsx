"use client";

import { useState, useCallback, useEffect } from "react";
import { Share2 } from "lucide-react";
import { SiWhatsapp, SiX, SiFacebook } from "@icons-pack/react-simple-icons";
import { useAudio } from "@/context/AudioContext";
import { useGenre } from "@/context/GenreContext";
import { socket } from "@/lib/socket";

export default function MobileShareButton() {
  const { title, artist } = useAudio();
  const { currentGenre } = useGenre();
  const [showDropdown, setShowDropdown] = useState(false);
  const [shareMode, setShareMode] = useState<"current" | "next">("next");
  const [nextSong, setNextSong] = useState<{
    title: string;
    artist: string;
  } | null>(null);

  const fetchNextSong = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/next?genre=${currentGenre}`);
      if (!res.ok) return;
      const data = await res.json();
      const next = data.upcoming?.[0] || data.nextIfNoRequests || null;
      setNextSong(next ? { title: next.title, artist: next.artist } : null);
    } catch {
      // silencioso
    }
  }, [currentGenre]);

  useEffect(() => {
    fetchNextSong();
    socket.on("song:changed", fetchNextSong);
    return () => {
      socket.off("song:changed", fetchNextSong);
    };
  }, [fetchNextSong]);

  const songToShare =
    shareMode === "current"
      ? { title, artist }
      : nextSong
        ? { title: nextSong.title, artist: nextSong.artist }
        : null;

  const shareText = songToShare
    ? `🎶 ${shareMode === "current" ? "Toca agora" : "Já já toca"} "${songToShare.title}" de ${songToShare.artist} na Som do Mato! Vem ouvir ao vivo e sentir a emoção do sertanejo! 🤠🔥\n\nhttps://somdomato.com`
    : null;

  const shareLinks = shareText
    ? {
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
        x: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}&u=${encodeURIComponent("https://somdomato.com")}`,
      }
    : null;

  if (!shareLinks) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center justify-center w-8 h-8"
        aria-label="Compartilhar música"
        title="Compartilhar música"
      >
        <Share2 size={15} className="text-white/70" />
      </button>

      {showDropdown && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
            aria-label="Fechar"
          />
          <div className="absolute right-0 top-full mt-2 bg-background-alt border border-primary/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 p-3 min-w-52">
            <div className="space-y-1">
              <label
                className={`flex items-center gap-1 cursor-pointer ${shareMode === "current" ? "bg-white/5" : ""} p-2 rounded transition`}
              >
                <input
                  type="radio"
                  name="mobile-share-mode"
                  value="current"
                  checked={shareMode === "current"}
                  onChange={() => setShareMode("current")}
                  className="w-3 h-3 accent-primary hidden"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-400">Música atual</div>
                  <div className="text-[10px] text-white font-medium truncate">
                    {title}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {artist}
                  </div>
                </div>
              </label>

              {nextSong && (
                <label
                  className={`flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition ${shareMode === "next" ? "bg-white/5" : ""}`}
                >
                  <input
                    type="radio"
                    name="mobile-share-mode"
                    value="next"
                    checked={shareMode === "next"}
                    onChange={() => setShareMode("next")}
                    className="w-3 h-3 accent-primary hidden"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-300">
                      Próxima música
                    </div>
                    <div className="text-[10px] text-white font-medium truncate">
                      {nextSong.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {nextSong.artist}
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="pt-3">
              <div className="text-[9px] text-slate-500 mb-2 px-1">
                Compartilhar:
              </div>
              <div className="flex items-center gap-2 justify-center">
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDropdown(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#25D366]/20 hover:bg-[#25D366]/40 transition"
                  title="WhatsApp"
                >
                  <SiWhatsapp size={16} className="text-[#25D366]" />
                </a>
                <a
                  href={shareLinks.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDropdown(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
                  title="X"
                >
                  <SiX size={14} className="text-white" />
                </a>
                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowDropdown(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1877F2]/20 hover:bg-[#1877F2]/40 transition"
                  title="Facebook"
                >
                  <SiFacebook size={16} className="text-[#1877F2]" />
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
