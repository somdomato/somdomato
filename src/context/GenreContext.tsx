"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Genre = "geral" | "gaucha" | "modao" | "arrocha" | "romantico" | "forro";

export const GENRES: { value: Genre; label: string; mountpoint: string }[] = [
  { value: "geral", label: "Geral", mountpoint: "geral" },
  { value: "gaucha", label: "Gaúcha", mountpoint: "gaucha" },
  { value: "modao", label: "Modão", mountpoint: "modao" },
  { value: "arrocha", label: "Arrocha", mountpoint: "arrocha" },
  { value: "romantico", label: "Romântico", mountpoint: "romantico" },
  { value: "forro", label: "Forró", mountpoint: "forro" },
];

interface GenreContextType {
  currentGenre: Genre;
  setGenre: (genre: Genre) => void;
  getStreamUrl: () => string;
}

const GenreContext = createContext<GenreContextType | undefined>(undefined);

export function GenreProvider({ children }: { children: ReactNode }) {
  const [currentGenre, setCurrentGenre] = useState<Genre>("geral");

  // Carregar gênero salvo do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedGenre");
    if (saved && GENRES.find((g) => g.value === saved)) {
      setCurrentGenre(saved as Genre);
    }
  }, []);

  const setGenre = (genre: Genre) => {
    setCurrentGenre(genre);
    localStorage.setItem("selectedGenre", genre);
  };

  const getStreamUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_RADIO_SOURCE || "https://radio.somdomato.com";
    const mountpoint = GENRES.find((g) => g.value === currentGenre)?.mountpoint || "geral";
    return `${baseUrl}/${mountpoint}`;
  };

  return <GenreContext.Provider value={{ currentGenre, setGenre, getStreamUrl }}>{children}</GenreContext.Provider>;
}

export function useGenre() {
  const context = useContext(GenreContext);
  if (!context) {
    throw new Error("useGenre must be used within GenreProvider");
  }
  return context;
}
