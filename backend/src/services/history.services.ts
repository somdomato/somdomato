import { db } from '@/drizzle'
import * as schema from '@/drizzle/schema'

export async function addHistory(id: number, requester = 'AutoDJ') {
  const request = await db.insert(schema.history).values({ songId: id, requester }).returning()
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