import { db } from '@/drizzle'
import { eq, or, like } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function getSong(id: number) {
  const [song] = await db.select()
    .from(schema.songs)
    .where(eq(schema.songs.id, id)).limit(1)

  if (!song) return { message: 'Música não encontrada', ok: false }

  return { message: 'Música encontrada', song, ok: true }
}

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