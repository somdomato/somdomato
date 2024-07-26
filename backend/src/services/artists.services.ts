import { db } from '@/drizzle'
import { eq, desc } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function getArtist(artistId: number) {
  const data = await db.select()
    .from(schema.artists)
    .where(eq(schema.artists.id, artistId))
    .leftJoin(schema.songs, eq(schema.songs.artistId, artistId))
    .orderBy(desc(schema.songs.playedAt))

  return data
}