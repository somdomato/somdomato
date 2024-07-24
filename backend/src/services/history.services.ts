import { db } from '@/drizzle'
import { desc } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function addHistory(id: number, requester = 'AutoDJ') {
  const request = await db.insert(schema.history).values({ songId: id }).returning()
  if (!request) return { message: 'Erro ao pedir música', ok: false }
  return { message: 'Sucesso ao pedir música: ' + JSON.stringify(request), ok: true }
}

export async function getHistory() {
  const last = await db.select().from(schema.history).orderBy(desc(schema.history.id)).limit(10)
  if (!last) return 'Sem histórico'
  return last
}