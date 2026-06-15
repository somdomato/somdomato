"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { socket } from "@/lib/socket";

interface LiveState {
  live: boolean;
  djName: string | null;
}

const LiveContext = createContext<LiveState>({ live: false, djName: null });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ live: false, djName: null });

  useEffect(() => {
    // Buscar estado inicial
    fetch("/api/live")
      .then((r) => r.json())
      .then((data) => setState(data))
      .catch(() => {});

    // Ouvir mudanças em tempo real
    const onLiveChanged = (data: LiveState) => setState(data);
    socket.on("live:changed", onLiveChanged);
    return () => {
      socket.off("live:changed", onLiveChanged);
    };
  }, []);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveState {
  return useContext(LiveContext);
}
