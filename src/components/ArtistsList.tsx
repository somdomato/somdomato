"use client";

import React from "react";
import Image from "next/image";

interface Artist {
  artist: string;
  cover?: string | null;
  count?: number;
}

export default function ArtistsList({ onSelect }: { onSelect: (artist: string) => void }) {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/artists")
      .then((r) => r.json())
      .then((data) => {
        setArtists(data.artists || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Carregando artistas...</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {artists.map((a) => (
        <button key={a.artist} onClick={() => onSelect(a.artist)} className="flex flex-col items-center gap-2 p-3 bg-surface border border-primary/10 rounded hover:shadow-sm transition">
          <div className="w-24 h-24 relative rounded overflow-hidden">
            <Image src={a.cover || "/images/logotipo.svg"} alt={a.artist} fill sizes="96px" className="object-cover" />
          </div>
          <div className="text-sm font-semibold text-center">{a.artist}</div>
          <div className="text-xs text-muted">{a.count ?? ""}</div>
        </button>
      ))}
    </div>
  );
}
