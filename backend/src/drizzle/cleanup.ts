import { db } from '@/drizzle'
import { eq } from 'drizzle-orm'
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
  files.push({ artist: artist.trim(), title: title?.trim() || '', path: file })
}
await db.insert(schema.songs).values(files).onConflictDoNothing()

const allSongs = await db.select().from(schema.songs)

for await (const song of allSongs) {
  const file = Bun.file(song.path)
  
  if (!await file.exists()) {
    console.log(`A música ID: ${song.id} não existe mais, removendo...`)
    await db.delete(schema.songs).where(eq(schema.songs.id, song.id))
  }
}

console.log('🧹 Cleanup complete.')