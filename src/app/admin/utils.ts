import { sql } from "drizzle-orm";
import { db } from "@/db";
import { songs, history, requests } from "@/db/schema";

export const PAGE_SIZE = 10;

export async function getRequests(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(requests)
    .orderBy(requests.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(requests);
  return { data, total: Number(count) };
}

export async function getHistory(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(history)
    .orderBy(history.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(history);
  return { data, total: Number(count) };
}

export async function getSongs(page: number) {
  const offset = (page - 1) * PAGE_SIZE;
  const data = await db
    .select()
    .from(songs)
    .orderBy(songs.id)
    .limit(PAGE_SIZE)
    .offset(offset);
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(songs);
  return { data, total: Number(count) };
}

export async function getTopPlayed(limit = 5) {
  const result = await db
    .select({ songId: history.songId, plays: sql`COUNT(*)` })
    .from(history)
    .groupBy(history.songId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);
  const songIds = result.map((r) => r.songId);
  if (songIds.length === 0) return [];
  const songsResult = await db
    .select()
    .from(songs)
    .where(sql`${songs.id} IN (${songIds.join(",")})`);
  const map = new Map(songsResult.map((s) => [s.id, s]));
  return songIds.map((id) => ({ id, ...map.get(id) }));
}
