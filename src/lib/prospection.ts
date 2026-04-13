/**
 * Sistema de Prospecção de Próximas Músicas
 *
 * Cache em memória que armazena a próxima música pré-selecionada por gênero.
 * Garante estabilidade visual no bloco "Próximas" da interface.
 *
 * Fluxo:
 * 1. `/api/songs/next` é chamado → se não há cache, computa via selectRandomSong(), cacheia e retorna
 * 2. Chamadas subsequentes retornam o mesmo resultado (estável)
 * 3. `/api/music` seleciona uma música para Liquidsoap → limpa o cache do gênero
 * 4. `/api/music/started` (on_track) confirma reprodução → emite song:changed → UI chama `/api/songs/next` → recomputa
 *
 * Pending: Rastreia músicas servidas ao Liquidsoap aguardando confirmação de reprodução.
 * Se o on_track nunca dispara, a próxima chamada de `/api/music` insere o histórico pendente.
 */

import { selectRandomSong } from "@/lib/rotation";

export interface ProspectedSong {
  id: number;
  title: string;
  artist: string;
  cover: string | null;
}

export interface PendingSong {
  songId: number;
  title: string;
  artist: string;
  cover: string | null;
  genre: string;
  wasRequested: boolean;
  selectedAt: number;
}

// Cache de próximas músicas pré-selecionadas por gênero (estável entre chamadas)
const prospectionCache = new Map<string, ProspectedSong>();

// Músicas pendentes aguardando confirmação via /api/music/started
const pendingCache = new Map<string, PendingSong>();

// ID da última música servida por gênero (excluída da prospecção)
const lastServedId = new Map<string, number>();

/**
 * Retorna a música prospectada para o gênero, computando e cacheando se necessário.
 */
export async function getProspectedSong(
  genre: string,
): Promise<ProspectedSong | null> {
  const cached = prospectionCache.get(genre);
  if (cached) return cached;

  const excludeId = lastServedId.get(genre);
  const song = await selectRandomSong(excludeId, genre);
  if (!song) return null;

  const prospected: ProspectedSong = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    cover: song.cover || null,
  };

  prospectionCache.set(genre, prospected);
  return prospected;
}

/**
 * Consome e retorna a música prospectada para o gênero.
 * Remove do cache após retornar.
 * Usada por `/api/music` para servir a mesma música mostrada na UI.
 */
export function consumeProspectedSong(genre: string): ProspectedSong | null {
  const cached = prospectionCache.get(genre);
  if (cached) prospectionCache.delete(genre);
  return cached || null;
}

/**
 * Limpa o cache de prospecção para um gênero.
 * Chamado quando `/api/music` seleciona uma nova música.
 */
export function clearProspection(genre: string): void {
  prospectionCache.delete(genre);
}

/**
 * Registra o ID da última música servida para exclusão na prospecção.
 */
export function setLastServedId(genre: string, songId: number): void {
  lastServedId.set(genre, songId);
}

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
