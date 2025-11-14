"use client";

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import type { HistoryWithSongs } from "@/types/song";

export default function History() {
  const [history, setHistory] = useState<HistoryWithSongs[]>([]);

  useEffect(() => {
    function fetchRequests() {
      fetch("/api/history")
        .then((res) => res.json())
        .then((data) => {
          setHistory(data.history);
        });
    }

    // Initial fetch
    fetchRequests();

    // Attach listeners (socket queues until connect)
    socket.on("song:changed", fetchRequests);

    return () => {
      socket.off("song:changed", fetchRequests);
    };
  }, []);

  return (
    <div className="bg-background border-2 border-black/50 rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Últimas</h2>
      {history.map(({ song, history }) => (
        <div key={history?.songId} className="mb-2 flex items-center justify-between">
          <div>
            {/* Support older rows that still may come as `songs` or missing.
            `song` is now provided by the API, but keep a graceful fallback. */}
            <p className="font-semibold">{song?.title ?? "Música removida"}</p>
            <p className="text-sm text-gray-600">{song?.artist ?? "Artista desconhecido"}</p>
          </div>
          <div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/likes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ songId: history?.songId }),
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
      ))}
    </div>

    //     <div className="bg-background border-2 border-black/50 rounded-lg p-4">
    //   <h2 className="text-2xl font-bold mb-4">Últimas</h2>
    //   {history.map(({ songs }) => (
    //     <div key={songs?.id} className="mb-2">
    //       <p className="font-semibold">{songs?.title}</p>
    //       <p className="text-sm text-gray-600">{songs?.artist}</p>
    //     </div>
    //   ))}
    // </div>
  );
}
