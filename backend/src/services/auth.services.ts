import { db } from '@/drizzle'
import { or, eq } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function signin(identifier: string, password: string) {
  const user = await findUserByIdentifier(identifier)
  if (!user) return { message: 'O usuário não existe', ok: false }
  if (user.password !== password) return { message: 'Senha incorreta', ok: false }
  
  return { message: 'Usuário adicionado com sucesso', ok: true }
}

export async function signup(username: string, email: string, password: string) {
  const data = await db.insert(schema.users).values({ username, email, password }).onConflictDoNothing().returning()
  if (!data) return { message: 'O usuário já existe', ok: false }
  return { message: 'Usuário adicionado com sucesso', ok: true }
}

export async function findUserByIdentifier(identifier: string) {
  const [user] = await db.select().from(schema.users)
    .where(
      or(
        eq(schema.users.username, identifier), 
        eq(schema.users.email, identifier)
      )
    ).limit(1)
  
  if (!user) return null
  return user
}