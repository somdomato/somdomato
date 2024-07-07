import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/drizzle/schema'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

const sqlite = new Database(join(import.meta.dir, '..', '..', 'sqlite.db'))
export const db = drizzle(sqlite, { schema })