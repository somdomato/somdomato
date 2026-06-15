"use client";

import { useEffect, useRef, useState } from "react";

export default function ChatEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-full overflow-hidden rounded-lg border border-primary/10 flex-1 min-h-150"
    >
      {shouldLoad && (
        <iframe
          className="absolute inset-0 w-full h-full"
          src="https://irc.somdomato.com"
          title="Bate-Papo - Rádio Som do Mato"
          allowFullScreen
        />
      )}
    </div>
  );
}
