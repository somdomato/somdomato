import { db } from '@/drizzle'
import { eq, or, like } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { basename, parse } from 'node:path'

export async function addSong(path: string, rotation = 'normal', enabled = true) {
  const filename = parse(basename(path)).name
  const title = filename.split('-').pop()
  const artist = filename.split('-')[0]
  const songData = { artist: artist.trim(), title: title?.trim() || '', path: path.trim(), enabled, rotation }
  await db.insert(schema.songs).values(songData).onConflictDoNothing()
}

export async function getSong(id: number) {
  const [song] = await db.select()
    .from(schema.songs)
    .where(eq(schema.songs.id, id)).limit(1)

  if (!song) return null

  return song
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