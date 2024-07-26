import { db } from '@/drizzle'
import { eq, desc } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { getSong } from '@/services/songs.services'
import { timeDiffMinutes } from '@/utils/time'

export async function addHistory(id: number, requester = 'AutoDJ') {
  const song = await getSong(id)
  const request = await db.insert(schema.history).values({ artistId: song?.id, songId: id, requester, createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) }).returning()
  if (!request) return { message: 'Erro ao pedir música', ok: false }
  return { message: 'Sucesso ao pedir música: ' + JSON.stringify(request), ok: true }
}

export async function getHistory() {
  return await db.query.history.findMany({
    orderBy: (history, { desc }) => [desc(history.id)],
    limit: 10,
    with: {
      song: true      
    }
  })
}

// export async function getHistBySong(songId: number) {
//   const now = Math.floor(Date.now() / 1000)

//   const [data] = await db.select()
//     .from(schema.history)
//     .where(eq(schema.history.songId, songId))
//     .leftJoin(schema.requests, eq(schema.requests.songId, songId))
//     .orderBy(desc(schema.history.id), desc(schema.requests.id))
//     .limit(1)

//   if (!data) return null
  
//   const createdHistory = new Date(data.history.createdAt + 'Z') // Adicionando 'Z' no final para garantir que seja interpretada como UTC
//   const pastHistory = Math.floor(createdHistory.getTime() / 1000)
//   const diffHistory = now - pastHistory
//   const timeHistory = Math.floor(diffHistory / 60)  

//   if (data.requests) {
//     const createdRequest = new Date(data.requests.createdAt + 'Z') // Adicionando 'Z' no final para garantir que seja interpretada como UTC
//     const pastRequest = Math.floor(createdRequest.getTime() / 1000)
//     const diffRequest = now - pastRequest
//     const timeRequest = Math.floor(diffRequest / 60)  
//     return { history: { time: timeHistory }, request: { time: timeRequest } }
//   }
  
//   return { history: { time: timeHistory }, request: { time: null } }
// }

// export async function getHistByArtist(artistId: number) {
//   const now = Math.floor(Date.now() / 1000)
  
//   const [data] = await db.select()
//     .from(schema.history)
//     .where(eq(schema.history.artistId, artistId))
//     .leftJoin(schema.requests, eq(schema.requests.artistId, artistId))
//     .orderBy(desc(schema.history.id), desc(schema.requests.id))
//     .limit(1)

//   if (!data) return null
  
//   const createdHistory = new Date(data.history.createdAt + 'Z') // Adicionando 'Z' no final para garantir que seja interpretada como UTC
//   const pastHistory = Math.floor(createdHistory.getTime() / 1000)
//   const diffHistory = now - pastHistory
//   const timeHistory = Math.floor(diffHistory / 60)  

//   if (data.requests) {
//     const createdRequest = new Date(data.requests.createdAt + 'Z') // Adicionando 'Z' no final para garantir que seja interpretada como UTC
//     const pastRequest = Math.floor(createdRequest.getTime() / 1000)
//     const diffRequest = now - pastRequest
//     const timeRequest = Math.floor(diffRequest / 60)  
//     return { history: { time: timeHistory }, request: { time: timeRequest } }
//   }
  
//   return { history: { time: timeHistory }, request: { time: null } }
// }

export async function getLatestHistSong(songId: number) {
  const [data] = await db.select()
    .from(schema.history)
    .where(eq(schema.history.songId, songId))
    .orderBy(desc(schema.history.createdAt))
    .limit(1)

  return data ? timeDiffMinutes(data.createdAt) : null
}

export async function getLatestHistArtist(artistId: number) {
  const [data] = await db.select()
    .from(schema.history)
    .where(eq(schema.history.artistId, artistId))
    .orderBy(desc(schema.history.createdAt))
    .limit(1)
  
  return data ? timeDiffMinutes(data.createdAt) : null
}