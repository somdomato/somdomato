import { db } from "@/db";
import { jingles, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";

/**
 * In-memory counter: tracks songs played since last jingle per genre.
 */
const songCounters = new Map<string, number>();

export function incrementSongCounter(genre: string): void {
  songCounters.set(genre, (songCounters.get(genre) || 0) + 1);
}

export function resetSongCounter(genre: string): void {
  songCounters.set(genre, 0);
}

export function getSongCounter(genre: string): number {
  return songCounters.get(genre) || 0;
}

/**
 * Get the configured jingle interval (number of songs between jingles).
 * Defaults to 5 if not set.
 */
export async function getJingleInterval(): Promise<number> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "jingle_interval"))
    .get();
  return row ? Number(row.value) : 5;
}

/**
 * Select a random active jingle that exists on disk.
 * Returns null if no jingles are available.
 */
export async function getRandomJingle(): Promise<{
  id: number;
  title: string;
  path: string;
  filename: string;
  duration: number | null;
} | null> {
  const activeJingles = await db
    .select()
    .from(jingles)
    .where(eq(jingles.active, 1));

  if (activeJingles.length === 0) return null;

  // Shuffle and find one that exists on disk
  const shuffled = activeJingles.sort(() => Math.random() - 0.5);
  for (const jingle of shuffled) {
    try {
      await fs.access(jingle.path);
      return jingle;
    } catch {
      // File missing, skip
    }
  }

  return null;
}
