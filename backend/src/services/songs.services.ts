import { db } from '@/drizzle'
import { or, like } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function findSong(term: string) {
  const results = await db.select()
    .from(schema.songs)
    .where(
      or(
        like(schema.songs.artist, `%${term}%`),
        like(schema.songs.title, `%${term}%`)
      )
    ).limit(20)

  console.log(results[0])

  return { songs: results }
}