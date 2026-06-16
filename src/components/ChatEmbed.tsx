"use client";

import { useState } from "react";

export default function ChatEmbed() {
  const [shouldLoad, setShouldLoad] = useState(false);

  return (
    <div className="relative w-full max-w-full overflow-hidden rounded-lg border border-primary/10 flex-1 min-h-150">
      {shouldLoad ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src="https://irc.somdomato.com"
          title="Bate-Papo - Rádio Som do Mato"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-12 h-12 text-primary/40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <button
            onClick={() => setShouldLoad(true)}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Abrir Bate-Papo
          </button>
        </div>
      )}
    </div>
  );
}
