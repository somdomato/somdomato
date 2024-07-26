import { db } from '@/drizzle'
import { sql } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { setPlayed, setPlayedAndRequested } from '@/services/songs.services'
import { getRequest } from '@/services/requests.services'
import { broadcast } from '@/utils/websocket'

export async function getSong() {
  const { request } = await getRequest()
  if (request) {
    setPlayedAndRequested(request.id)
    return request.path
  }

  const [song] = await db.select()
    .from(schema.songs)
    .orderBy(sql`RANDOM()`)
    .limit(1)

  setPlayed(song.id)
  broadcast(JSON.stringify({ action: 'new-song', song }))
  return song.path
}