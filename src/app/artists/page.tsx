"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import ArtistsList from "@/components/ArtistsList";
import ArtistSongsTable from "@/components/ArtistSongsTable";

export default function ArtistsPage() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const displaySelected =
    selected === "__EMPTY_ARTIST__" ? "(Sem artista)" : selected;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      {selected === null ? (
        <>
          <h1 className="text-2xl font-bold mb-5">Artistas</h1>
          <ArtistsList onSelect={(a) => setSelected(a)} />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Artistas
          </button>
          <h1 className="text-2xl font-bold mb-5">{displaySelected}</h1>
          <ArtistSongsTable
            artist={selected === "__EMPTY_ARTIST__" ? "" : selected}
          />
        </>
      )}
    </main>
  );
}
