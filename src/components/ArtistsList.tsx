"use client";

import React from "react";
import CoverImage from "@/components/CoverImage";
import Spinner from "@/components/Spinner";
import { Search } from "lucide-react";

interface Artist {
  artist: string;
  cover?: string | null;
  count?: number;
}

function normalizeForSearch(s?: string | null) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function ArtistsList({
  onSelect,
}: {
  onSelect: (artist: string) => void;
}) {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/artists")
      .then((r) => r.json())
      .then((data) => {
        setArtists(data.artists || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return artists;
    const q = normalizeForSearch(search);
    return artists.filter((a) => normalizeForSearch(a.artist).includes(q));
  }, [artists, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="w-6 h-6" label="Carregando artistas..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Buscar artista..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-white/40 py-8 text-sm">
          Nenhum artista encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((a) => {
            const displayName = a.artist || "(Sem artista)";
            const keyName = a.artist || "__empty__";
            const selectValue =
              a.artist === "" ? "__EMPTY_ARTIST__" : String(a.artist);
            return (
              <button
                type="button"
                key={keyName}
                onClick={() => onSelect(selectValue)}
                className="group relative aspect-square rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <CoverImage
                  src={a.cover || "/images/logotipo.svg"}
                  alt={displayName}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">
                    {displayName}
                  </p>
                  {a.count != null && (
                    <p className="text-xs text-white/50 mt-0.5">
                      {a.count} {a.count === 1 ? "música" : "músicas"}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
