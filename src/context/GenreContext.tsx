"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  RADIO_CONFIG,
  GENRES,
  DEFAULT_GENRE,
  buildStreamUrl,
  type Genre,
} from "@/config";

interface GenreContextType {
  currentGenre: Genre;
  setGenre: (genre: Genre) => void;
  getStreamUrl: () => string;
}

const GenreContext = createContext<GenreContextType | undefined>(undefined);

export function GenreProvider({ children }: { children: ReactNode }) {
  const [currentGenre, setCurrentGenre] = useState<Genre>(DEFAULT_GENRE);

  // Carregar gênero salvo do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedGenre");
    if (saved && GENRES.find((g) => g.value === saved)) {
      if (RADIO_CONFIG.multipleMounts) {
        setCurrentGenre(saved as Genre);
      } else {
        setCurrentGenre(DEFAULT_GENRE);
      }
    }
  }, []);

  const setGenre = (genre: Genre) => {
    if (RADIO_CONFIG.multipleMounts) {
      setCurrentGenre(genre);
      localStorage.setItem("selectedGenre", genre);
    } else {
      setCurrentGenre(DEFAULT_GENRE);
      localStorage.setItem("selectedGenre", DEFAULT_GENRE);
    }
  };

  const getStreamUrl = () => {
    const mountpoint =
      GENRES.find((g) => g.value === currentGenre)?.mountpoint || DEFAULT_GENRE;
    return buildStreamUrl(mountpoint);
  };

  return (
    <GenreContext.Provider value={{ currentGenre, setGenre, getStreamUrl }}>
      {children}
    </GenreContext.Provider>
  );
}

export function useGenre() {
  const context = useContext(GenreContext);
  if (!context) {
    throw new Error("useGenre must be used within GenreProvider");
  }
  return context;
}

export { GENRES, type Genre };
