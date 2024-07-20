import { db } from '@/drizzle'
import * as schema from '@/drizzle/schema'
import { Glob } from 'bun'
import { basename, parse } from 'node:path'

const songsPath = Bun.env.SONGS_PATH
const glob = new Glob(`${songsPath}/**/*.mp3`)
const files = []

for await (const file of glob.scan(songsPath)) {
  const filename = parse(basename(file)).name
  const title = filename.split('-').pop()
  const artist = filename.split('-')[0]
  files.push({ artist: artist.trim(), title: title?.trim() || '', path: `${songsPath}/${file}` })
}

await db.insert(schema.songs).values(files).onConflictDoNothing()

console.log('🌱 Seeding complete.')