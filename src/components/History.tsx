"use client";

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import type { SongWithHistory } from "@/types/song";

export default function History() {
  const [history, setHistory] = useState<SongWithHistory[]>([]);

  useEffect(() => {
    if (socket.connected) {
      socket.on("history:added", fetchRequests);
    }

    function fetchRequests() {
      fetch("/api/history")
        .then((res) => res.json())
        .then((data) => {
          setHistory(data.history);
        });
    }

    return () => {
      socket.off("history:added", fetchRequests);
    };
  }, []);

  return (
    <div className="bg-background border-2 border-black/50 rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Últimas</h2>
      {history.map(({ songs }) => (
        <div key={songs?.id} className="mb-2">
          <p className="font-semibold">{songs?.title}</p>
          <p className="text-sm text-gray-600">{songs?.artist}</p>
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
