import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { getSong } from '@/services/songs.services'
import { broadcast } from '@/utils/websocket'
import { getHistBySong, getHistByArtist } from '@/services/history.services'

const MIN_TIME_ARTIST = 30
const MIN_TIME_SONG = 50

export async function addRequest(id: number) {
  const song = await getSong(id)
  if (!song) return { message: 'Música não encontrada', ok: false }

  const lastBySong = await getHistBySong(song.id)
  console.log(lastBySong)
  if (lastBySong && lastBySong.request && lastBySong.request.time && lastBySong.request.time < MIN_TIME_SONG) return { message: 'Música pedida recentemente', ok: false }
  if (lastBySong && lastBySong.history && lastBySong.history.time && lastBySong.history.time < MIN_TIME_SONG) return { message: 'Música pedida recentemente', ok: false }
  
  if (song.artistId) {
    const lastByArtist = await getHistByArtist(song.artistId)
    if (lastByArtist && lastByArtist.request && lastByArtist.request.time && lastByArtist.request.time < MIN_TIME_ARTIST) return { message: 'Artista pedido recentemente', ok: false }
    if (lastByArtist && lastByArtist.history && lastByArtist.history.time && lastByArtist.history.time < MIN_TIME_ARTIST) return { message: 'Artista pedido recentemente', ok: false }
  }

  const request = await db.insert(schema.requests).values({ artistId: song.artistId, songId: id, createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) }).returning()
  if (!request) return { message: 'Erro ao pedir música', ok: false }
  
  broadcast(JSON.stringify({ action: 'new-request', song }))
  return { message: 'Sucesso ao pedir música', request, ok: true }
}

export async function getRequest() {
  const request = await db.query.requests.findFirst({
    orderBy: (requests, { asc }) => [asc(requests.id)],
    where: (requests, { eq }) => (eq(requests.played, false)),
    with: {
      song: true      
    }
  })

  if (!request) return { message: 'Nenhum pedido na fila', ok: false }

  await db.update(schema.requests)
    .set({ played: true })
    .where(eq(schema.requests.id, request.id))

  return { message: 'Sucesso ao recuperar o último pedido', request: request.song, ok: false }
}

export async function listRequests() {
  const result = await db.query.requests.findMany({
    where: (requests, { eq }) => (eq(requests.played, false)),
    with: {
      song: true      
    }
  })

  return result
}