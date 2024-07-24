import { db } from '@/drizzle'
import { eq, sql } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { Glob } from 'bun'
import { getRequest } from './requests.services'

const SONGS = Bun.env.SONGS_PATH

export async function getRandomSong() {
  const request = await getRequest()
  if (request && request !== 'Sem pedidos') return request

  const [song] = await db.select()
    .from(schema.songs)
    .orderBy(sql`RANDOM()`)
    .limit(1)

  return song.path
}

export async function getRandomSongGenre(genre = 'Sertanejo') {
  const [song] = await db.select()
    .from(schema.songs)
    .where(
      eq(schema.songs.genre, genre)
    )
    .orderBy(sql`RANDOM()`)
    .limit(1)
  
  if (!song) return await getRandomSong()

  return song.path
}

export async function getRandomFile(genre: string | null = null): Promise<string> {
  const files = []
  let songsPath = `${SONGS}` 
  if (genre) songsPath = `${SONGS}/${genre}` 
  const glob = new Glob(`${songsPath}/**/*.mp3`)
  
  for await (const file of glob.scan(songsPath)) {
    files.push(`${file}`)
  }

  return files[Math.floor(Math.random() * files.length)]
}