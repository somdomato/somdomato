"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Gerar ou recuperar sessionId do localStorage
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("sdm_session_id");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem("sdm_session_id", sessionId);
  }
  return sessionId;
}

export default function PageTracker() {
  const pathname = usePathname();
  const lastTrackedRef = useRef<string>("");

  useEffect(() => {
    // Evitar tracking duplicado da mesma página
    if (lastTrackedRef.current === pathname) return;
    lastTrackedRef.current = pathname;

    const trackView = async () => {
      try {
        const sessionId = getSessionId();
        await fetch("/api/stats/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pathname,
            sessionId,
          }),
        });
      } catch (error) {
        // Silenciosamente falhar - não queremos quebrar a experiência do usuário
        console.warn("Falha ao registrar visualização:", error);
      }
    };

    trackView();
  }, [pathname]);

  return null;
}
