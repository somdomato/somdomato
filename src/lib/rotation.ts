/**
 * Sistema de Rotação de Músicas
 *
 * Este arquivo contém a lógica para selecionar músicas baseado no campo "rotation"
 */

import { db } from "@/db";
import { songs } from "@/db/schema";
import { and, ne } from "drizzle-orm";

export type RotationType = "inativo" | "leve" | "normal" | "pesado";

// Pesos de rotação: quanto maior, mais chance de tocar
const ROTATION_WEIGHTS = {
  inativo: 0, // Nunca toca automaticamente
  leve: 1,
  normal: 3,
  pesado: 5,
} as const;

/**
 * Verifica se uma música pode tocar no horário atual
 */
export function canPlayAtCurrentTime(timeSlots: number | null): boolean {
  if (!timeSlots) return false;
  if (timeSlots === 15) return true; // Todos os horários

  const hour = new Date().getHours();
  let slot = 0;

  if (hour >= 0 && hour < 6)
    slot = 1; // Madrugada
  else if (hour >= 6 && hour < 12)
    slot = 2; // Manhã
  else if (hour >= 12 && hour < 18)
    slot = 4; // Tarde
  else slot = 8; // Noite

  return (timeSlots & slot) !== 0;
}

/**
 * Seleciona uma música aleatória baseada no sistema de rotação
 * Músicas com peso maior têm mais chance de serem selecionadas
 */
export async function selectRandomSong(excludeSongId?: number) {
  // Buscar todas as músicas que não são inativas
  const allSongs = await db
    .select()
    .from(songs)
    .where(excludeSongId ? and(ne(songs.rotation, "inativo"), ne(songs.id, excludeSongId)) : ne(songs.rotation, "inativo"))
    .all();

  // Filtrar músicas que podem tocar no horário atual
  const availableSongs = allSongs.filter((song) => canPlayAtCurrentTime(song.timeSlots));

  if (availableSongs.length === 0) {
    return null;
  }

  // Criar array ponderado
  const weightedSongs: typeof availableSongs = [];

  for (const song of availableSongs) {
    const rotation = (song.rotation || "normal") as RotationType;
    const weight = ROTATION_WEIGHTS[rotation];

    // Adicionar a música N vezes baseado no peso
    for (let i = 0; i < weight; i++) {
      weightedSongs.push(song);
    }
  }

  // Selecionar aleatoriamente do array ponderado
  const randomIndex = Math.floor(Math.random() * weightedSongs.length);
  return weightedSongs[randomIndex];
}

/**
 * Exemplo de uso em um sistema de播放
 */
export async function getNextSongToPlay(currentSongId?: number) {
  // Primeiro verificar se há pedidos na fila
  // (implementar lógica de pedidos aqui)

  // Se não há pedidos, selecionar baseado na rotação
  return await selectRandomSong(currentSongId);
}
