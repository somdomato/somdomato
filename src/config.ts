// =============================================================================
// RADIO CONFIGURATION
// =============================================================================

export const RADIO_CONFIG = {
  // Base URL da rádio (Icecast)
  baseUrl: process.env.NEXT_PUBLIC_RADIO_SOURCE || "http://localhost:8000",

  // URL da API de metadados JSON do Icecast
  metadataUrl:
    process.env.NEXT_PUBLIC_RADIO_METADATA ||
    "https://radio.somdomato.com/json",

  // Intervalo de atualização de metadados (ms)
  metadataRefreshInterval: 10000, // 10 segundos

  // Habilitar seleção de múltiplos gêneros (mountpoints)
  multipleMounts: true,
} as const;

export const GENRES = [
  { value: "geral", label: "Geral", mountpoint: "geral" },
  { value: "gaucha", label: "Gaúcha", mountpoint: "gaucha" },
  { value: "modao", label: "Modão", mountpoint: "modao" },
  { value: "arrocha", label: "Arrocha", mountpoint: "arrocha" },
  { value: "romantico", label: "Romântico", mountpoint: "romantico" },
  { value: "forro", label: "Forró", mountpoint: "forro" },
] as const;

export type Genre = (typeof GENRES)[number]["value"];
export const DEFAULT_GENRE: Genre = "geral";

export const DEFAULT_SONG = {
  title: "Rádio Som do Mato",
  artist: "A mais sertaneja",
  cover: "/images/logotipo.svg",
} as const;

// =============================================================================
// APP CONFIGURATION
// =============================================================================

export const LAST_SONGS_HISTORY_LIMIT = 20;

/**
 * Delay em minutos antes de auto-aprovar uploads elegíveis.
 * 0 = aprovação imediata. Permite ao admin rejeitar antes da aprovação.
 */
export const AUTO_APPROVE_DELAY_MINUTES =
  Number(process.env.AUTO_APPROVE_DELAY_MINUTES) || 5;

export const slides = [
  {
    id: 1,
    src: "https://cdn.somdomato.com/images/slides/ys.webp",
    alt: "Yasmin Sensação",
    title: "Yasmin Sensação",
  },
  {
    id: 2,
    src: "https://cdn.somdomato.com/images/slides/jem.webp",
    alt: "Jorge & Mateus",
    title: "Jorge & Mateus",
    objectPosition: "center 20%",
  },
  {
    id: 3,
    src: "https://cdn.somdomato.com/images/slides/hej.webp",
    alt: "Henrique & Juliano",
    title: "Henrique & Juliano",
    objectPosition: "center 20%",
  },
  {
    id: 4,
    src: "https://cdn.somdomato.com/images/slides/mek.webp",
    alt: "Matheus & Kauan",
    title: "Matheus & Kauan",
    objectPosition: "center 20%",
  },
  {
    id: 5,
    src: "https://cdn.somdomato.com/images/slides/par.webp",
    alt: "Paraná",
    title: "Paraná",
    objectPosition: "center 20%",
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Constrói a URL de stream completa para um mountpoint
 */
export function buildStreamUrl(mountpoint: string = DEFAULT_GENRE): string {
  const base = RADIO_CONFIG.baseUrl.replace(/\/+$/, "");
  const mount = mountpoint.replace(/^\/+/, "");
  return `${base}/${mount}`;
}

/**
 * Valida se um gênero é válido
 */
export function isValidGenre(genre: string): genre is Genre {
  return GENRES.some((g) => g.value === genre);
}
