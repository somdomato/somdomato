"use client";

import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";
import type { SongWithRequests } from "@/types/song";

export default function Requests() {
  const [requests, setRequests] = useState<SongWithRequests[]>([]);

  useEffect(() => {
    if (socket.connected) {
      socket.on("request:added", fetchRequests);
      socket.on("request:removed", fetchRequests);
    }

    function fetchRequests() {
      fetch("/api/requests")
        .then((res) => res.json())
        .then((data) => {
          setRequests(data.requests);
        });
    }

    return () => {
      socket.off("request:added", fetchRequests);
      socket.off("request:removed", fetchRequests);
    };
  }, []);

  return (
    <div className="bg-background border-2 border-black/50 rounded-lg p-4">
      <h2 className="text-2xl font-bold mb-4">Próximas</h2>
      {requests.map(({ songs }) => (
        <div key={songs?.id} className="mb-2">
          <p className="font-semibold">{songs?.title}</p>
          <p className="text-sm text-gray-600">{songs?.artist}</p>
        </div>
      ))}
    </div>
  );
}
