import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/drizzle/schema'
import { Database } from 'bun:sqlite'

const client = new Database('sqlite.db')
export const db = drizzle(client, { schema })