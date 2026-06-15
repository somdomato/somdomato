/**
 * Rastreamento de Música Pendente
 *
 * Cache em memória de músicas servidas ao Liquidsoap aguardando confirmação
 * de reprodução via `on_track`.
 *
 * Fluxo:
 * 1. `/api/music` seleciona uma música (via `@/lib/queue`) e registra como pending.
 * 2. `/api/music/started` (on_track) confirma reprodução, consome o pending,
 *    insere o histórico e emite `song:changed`.
 * 3. Se o on_track nunca dispara, a próxima chamada de `/api/music` insere o
 *    histórico pendente (flush) antes de registrar a nova música.
 */

export interface PendingSong {
  songId: number;
  title: string;
  artist: string;
  cover: string | null;
  genre: string;
  wasRequested: boolean;
  requestedAt?: number | null;
  selectedAt: number;
}

// Músicas pendentes aguardando confirmação via /api/music/started
const pendingCache = new Map<string, PendingSong>();

/**
 * Registra uma música como pendente (servida ao Liquidsoap, aguardando on_track).
 */
export function setPendingSong(genre: string, pending: PendingSong): void {
  pendingCache.set(genre, pending);
}

/**
 * Retorna e remove a música pendente para um gênero.
 * Usada por `/api/music/started` ao confirmar início de reprodução.
 */
export function consumePendingSong(genre: string): PendingSong | null {
  const pending = pendingCache.get(genre);
  if (pending) pendingCache.delete(genre);
  return pending || null;
}

/**
 * Retorna a música pendente sem removê-la (para verificação/flush).
 */
export function getPendingSong(genre: string): PendingSong | null {
  return pendingCache.get(genre) || null;
}
