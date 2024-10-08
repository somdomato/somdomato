import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'

const sqlite = new Database(join(import.meta.dir, '..', '..', 'sqlite.db'))
const db = drizzle(sqlite)
await migrate(db, { migrationsFolder: './src/drizzle/migrations' })
