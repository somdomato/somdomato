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
    socket.on("request:added", fetchRequests);
    socket.on("request:removed", fetchRequests);
    socket.on("song:updated", fetchRequests);

    return () => {
      socket.off("request:added", fetchRequests);
      socket.off("request:removed", fetchRequests);
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
        return (
          <div
            key={req.id ?? song?.id}
            className="mb-2 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">{song?.title}</p>
              <p className="text-sm text-gray-600">{song?.artist}</p>
            </div>
            <div>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/likes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ songId: song?.id }),
                    });
                    const json = await res.json();
                    if (json.success) toast.success("Obrigado pelo like!");
                    else toast.error(json.error || "Falha ao curtir");
                  } catch (err) {
                    console.error(err);
                    toast.error("Falha ao curtir");
                  }
                }}
                className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
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
