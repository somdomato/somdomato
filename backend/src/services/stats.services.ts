import { db } from '@/drizzle'
import { count } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'

export async function stats() {
  const [songs] = await db.select({ count: count() }).from(schema.songs)
  const [artists] = await db.select({ count: count() }).from(schema.artists)
  const [users] = await db.select({ count: count() }).from(schema.users)
  
  return { songs: songs.count, artists: artists.count, users: users.count }
}