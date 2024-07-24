import { db } from '@/drizzle'
import { eq, sql } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { Glob } from 'bun'
import { getRequest } from '@/services/requests.services'
import { addHistory } from '@/services/history.services'
import { broadcastMessage } from '@/utils/websocket'

const SONGS = Bun.env.SONGS_PATH

export async function getRandomSong() {
  const { request } = await getRequest()
  if (request) {
    addHistory(request.id, 'Anônimo')    
    return request.path
  }

  const [song] = await db.select()
    .from(schema.songs)
    .orderBy(sql`RANDOM()`)
    .limit(1)

  addHistory(song.id, 'AutoDJ')

  broadcastMessage(JSON.stringify({ action: 'new-song', song }))

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

  addHistory(song.id, 'AutoDJ')

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
  // addHistory(song.id, 'AutoDJ')

  return files[Math.floor(Math.random() * files.length)]
}