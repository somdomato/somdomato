export type Genre = "geral" | "gaucha" | "modao" | "arrocha" | "romantico" | "forro";

export const GENRES: { value: Genre; label: string }[] = [
  { value: "geral", label: "Geral" },
  { value: "gaucha", label: "Gaúcha" },
  { value: "modao", label: "Modão" },
  { value: "arrocha", label: "Arrocha" },
  { value: "romantico", label: "Romântico" },
  { value: "forro", label: "Forró" },
];

export const GENRE_LABELS: Record<Genre, string> = {
  geral: "Geral",
  gaucha: "Gaúcha",
  modao: "Modão",
  arrocha: "Arrocha",
  romantico: "Romântico",
  forro: "Forró",
};
