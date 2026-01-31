"use client";

import React from "react";
import ArtistsList from "@/components/ArtistsList";
import ArtistSongsTable from "@/components/ArtistSongsTable";

export default function ArtistsPage() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const songsRef = React.useRef<HTMLDivElement>(null);

  const displaySelected = selected === "__EMPTY_ARTIST__" ? "(Sem artista)" : selected;

  // Scroll to songs section when artist is selected
  React.useEffect(() => {
    if (selected && songsRef.current) {
      songsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Artistas</h1>
      <div className="mb-6">
        <ArtistsList onSelect={(a) => setSelected(a)} />
      </div>

      {selected !== null && (
        <section ref={songsRef} className="mt-8 scroll-mt-4">
          <div className="flex items-center justify-between mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <h2 className="text-xl font-semibold">Músicas de {displaySelected}</h2>
            <button 
              className="text-sm px-4 py-2 bg-primary/20 hover:bg-primary/30 rounded transition" 
              onClick={() => setSelected(null)}
            >
              Voltar
            </button>
          </div>
          <ArtistSongsTable artist={selected === "__EMPTY_ARTIST__" ? "" : selected} />
        </section>
      )}
    </main>
  );
}
