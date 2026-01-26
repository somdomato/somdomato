"use client";

import React from "react";
import ArtistsList from "@/components/ArtistsList";
import ArtistSongsTable from "@/components/ArtistSongsTable";

export default function ArtistsPage() {
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Artistas</h1>
      <div className="mb-6">
        <ArtistsList onSelect={(a) => setSelected(a)} />
      </div>

      {selected && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Músicas de {selected}</h2>
            <button className="text-sm text-primary" onClick={() => setSelected(null)}>
              Voltar
            </button>
          </div>
          <ArtistSongsTable artist={selected} />
        </section>
      )}
    </main>
  );
}
