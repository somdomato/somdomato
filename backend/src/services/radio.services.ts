import { db } from '@/drizzle'
import { sql } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { getRequest } from '@/services/requests.services'
import { addHistory } from '@/services/history.services'
import { broadcast } from '@/utils/websocket'

const SONGS = Bun.env.SONGS_PATH

export async function getSong() {
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

  broadcast(JSON.stringify({ action: 'new-song', song }))

  return song.path
}