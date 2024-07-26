import { db } from '@/drizzle'
import { eq, desc } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { getSong } from '@/services/songs.services'
import { broadcast } from '@/utils/websocket'
import { getLatestHistSong, getLatestHistArtist } from '@/services/history.services'
import { timeDiffMinutes } from '@/utils/time'

const MIN_TIME_ARTIST = 30
const MIN_TIME_SONG = 50

export async function addRequest(id: number) {
  const song = await getSong(id)
  if (!song || !song.artistId) return { message: 'Música não encontrada', ok: false }

  const lastRequestBySong = await getLatestRequestSong(song.id)
  if (lastRequestBySong && lastRequestBySong < MIN_TIME_SONG) return { message: 'Música pedida recentemente', ok: false }

  const lastRequestByArtist = await getLatestRequestArtist(song.artistId)
  if (lastRequestByArtist && lastRequestByArtist < MIN_TIME_ARTIST) return { message: 'Música pedida recentemente', ok: false }

  const lastHistSong = await getLatestHistSong(song.id)
  if (lastHistSong && lastHistSong < MIN_TIME_SONG) return { message: 'Música pedida recentemente', ok: false }

  const lastHistArtist = await getLatestHistArtist(song.artistId)
  if (lastHistArtist && lastHistArtist < MIN_TIME_ARTIST) return { message: 'Música pedida recentemente', ok: false }

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

export async function getLatestRequestSong(songId: number) {
  const [data] = await db.select()
    .from(schema.requests)
    .where(eq(schema.requests.songId, songId))
    .orderBy(desc(schema.requests.createdAt))
    .limit(1)

  return data ? timeDiffMinutes(data.createdAt) : null
}

export async function getLatestRequestArtist(artistId: number) {
  const [data] = await db.select()
    .from(schema.requests)
    .where(eq(schema.requests.artistId, artistId))
    .orderBy(desc(schema.requests.createdAt))
    .limit(1)

    // console.log(timeDiffMinutes(data.createdAt))

  return data ? timeDiffMinutes(data.createdAt) : null
}