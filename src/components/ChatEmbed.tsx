"use client";

import { useEffect, useState } from "react";

const chatUrl = process.env.NEXT_PUBLIC_CHAT_URL ?? "https://irc.somdomato.com";

export default function ChatEmbed() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fallback: o evento onLoad pode nunca disparar (ex: requisição bloqueada
  // por extensão/firewall) ou ser perdido por uma corrida com a hidratação.
  // Sem isso o iframe ficaria escondido para sempre, sem nenhum sinal de erro.
  useEffect(() => {
    const timeout = setTimeout(() => setLoaded(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full max-w-full rounded-lg border border-primary/10 flex-1 min-h-140">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Carregando chat...
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive text-center px-4">
          Não foi possível carregar o chat. Tente novamente mais tarde.
        </div>
      )}
      <iframe
        className={`absolute inset-0 w-full h-full outline-none rounded-md ${loaded && !failed ? "block" : "hidden"}`}
        src={chatUrl}
        title="Bate-Papo - Rádio Som do Mato"
        allowFullScreen
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          setFailed(true);
        }}
      />
    </div>
  );
}
