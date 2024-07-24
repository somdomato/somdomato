import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function addRequest(id: number) {
  return await db.insert(schema.requests).values({ songId: id })
}

export async function getRequest() {
  const request = await db.query.requests.findFirst({
    orderBy: (requests, { asc }) => [asc(requests.id)],
    where: (requests, { eq }) => (eq(requests.played, false)),
    with: {
      song: true      
    }
  })

  if (!request) return 'Sem pedidos'

  await db.update(schema.requests)
    .set({ played: true })
    .where(
      eq(schema.requests.id, request.id)
    )

  return request.song?.path || 'Sem pedidos'
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