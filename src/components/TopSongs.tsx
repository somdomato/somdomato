"use client";

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import type { Song } from "@/types/song";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export default function TopSongs() {
  const [by, setBy] = useState<"plays" | "likes">("plays");
  const [top, setTop] = useState<Song[]>([]);

  useEffect(() => {
    function fetchTop() {
      const query = by === "likes" ? "?by=likes" : "";
      fetch(`/api/top10${query}`)
        .then((res) => res.json())
        .then((data) => {
          setTop(data.top || []);
        });
    }

    fetchTop();

    socket.on("song:changed", fetchTop);
    socket.on("like:added", fetchTop);
    // Older event name used in backend was plural. Support both for backwards compatibility.
    socket.on("likes:added", fetchTop);
    return () => {
      socket.off("song:changed", fetchTop);
      socket.off("like:added", fetchTop);
      socket.off("likes:added", fetchTop);
    };
  }, [by]);

  async function likeSong(id: number) {
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Obrigado pelo like!");
      } else {
        toast.error(json.error || "Falha ao curtir");
      }
    } catch (err) {
      console.error(err);
      toast.error("Falha ao curtir");
    }
  }

  return (
    <div className="bg-background border-2 border-black/50 rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">TOP 10</h2>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            className={`px-2 py-1 rounded ${by === "plays" ? "bg-gray-700 text-white" : "bg-gray-200"}`}
            onClick={() => setBy("plays")}
          >
            Tocados
          </button>
          <button
            className={`px-2 py-1 rounded ${by === "likes" ? "bg-gray-700 text-white" : "bg-gray-200"}`}
            onClick={() => setBy("likes")}
          >
            Curtidas
          </button>
        </div>
      </div>
      {top.map((song) => (
        <div key={song.id} className="mb-2 flex items-center justify-between">
          <div>
            <p className="font-semibold">{song.title}</p>
            <p className="text-sm text-gray-600">{song.artist}</p>
          </div>
          <div>
            <button
              onClick={() => likeSong(song.id)}
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              <Heart size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
