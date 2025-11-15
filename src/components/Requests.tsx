"use client";

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import type { SongWithRequests } from "@/types/song";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export default function Requests() {
  const [requests, setRequests] = useState<SongWithRequests[]>([]);

  useEffect(() => {
    function fetchRequests() {
      fetch("/api/requests")
        .then((res) => res.json())
        .then((data) => {
          setRequests(data.requests);
        });
    }

    // Fetch initial data
    fetchRequests();

    // Always attach listeners. socket.io-client queues them until connect.
    socket.on("request:added", (payload) => {
      // If payload contains the request + song metadata, update the list in
      // place to avoid an extra network request and show the new request
      // instantly. Otherwise fall back to fetching the full list.
      if (payload?.request) {
        setRequests((prev) => {
          const exists = prev.some((r) => r.id === payload.request.id);
          if (exists) return prev;
          return [
            ...prev,
            { ...payload.request, song: payload.song } as SongWithRequests,
          ];
        });
      } else {
        fetchRequests();
      }
    });

    socket.on("request:removed", (payload) => {
      if (payload?.requestId) {
        setRequests((prev) => prev.filter((r) => r.id !== payload.requestId));
      } else {
        fetchRequests();
      }
    });
    socket.on("song:updated", fetchRequests);

    return () => {
      socket.off("request:added");
      socket.off("request:removed");
      socket.off("song:updated", fetchRequests);
    };
  }, []);

  return (
    <div className="bg-background border-2 border-black/50 rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Próximas</h2>
      {requests.map((req) => {
        type RequestLike = {
          id?: number;
          song?: { id?: number; title?: string; artist?: string };
          songs?: { id?: number; title?: string; artist?: string };
        };
        const r = req as unknown as RequestLike;
        const song = r.song ?? r.songs;
        // If the referenced song was removed from DB, show a fallback so the
        // UI doesn't look empty. This can happen if a request points to a song
        // that no longer exists (deleted file, db cleanup, etc.).
        const title = song?.title ?? "Música removida";
        const artist = song?.artist ?? "Artist desconhecido";
        return (
          <div
            key={req.id ?? song?.id}
            className="mb-2 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-gray-600">{artist}</p>
            </div>
            <div>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/likes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      // The server returns only 'song' metadata without id in the requests API.
                      // Use the request's songId directly to ensure we send the real song id.
                      body: JSON.stringify({ songId: req.songId }),
                    });
                    const json = await res.json();
                    if (json.success) toast.success("Obrigado pelo like!");
                    else toast.error(json.error || "Falha ao curtir");
                  } catch (err) {
                    console.error(err);
                    toast.error("Falha ao curtir");
                  }
                }}
                className="px-2 py-1 rounded hover:text-gray-300"
              >
                <Heart size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
