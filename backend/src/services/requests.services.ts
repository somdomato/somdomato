import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { getSong } from '@/services/songs.services'
import { broadcast } from '@/utils/websocket'

export async function addRequest(id: number) {
  const song = await getSong(id)
  if (!song) return { message: 'Música não encontrada', ok: false }

  const request = await db.insert(schema.requests).values({ songId: id }).returning()
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