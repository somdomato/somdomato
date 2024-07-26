import { db } from '@/drizzle'
import * as schema from '@/drizzle/schema'
import { Glob } from 'bun'
import { basename, parse } from 'node:path'
import { randomIntFromInterval } from '@/utils'

const songsPath = Bun.env.SONGS_PATH
const glob = new Glob(`${songsPath}/**/*.mp3`)
const artists = []

for await (const file of glob.scan(songsPath)) {
  if (file.includes('vinhetas')) continue
  const filename = parse(basename(file)).name
  const artist = filename.split('-')[0].trim()
  const [added] = await db.insert(schema.artists).values({ name: artist }).onConflictDoNothing().returning()
  if (added) artists.push(added)
}

for await (const file of glob.scan(songsPath)) {
  if (file.includes('vinhetas')) continue
  const filename = parse(basename(file)).name
  const title = filename.split('-').pop()?.trim()
  const artist = filename.split('-')[0].trim()
  const artistId = artists.find(a => a.name === artist)?.id || null
  await db.insert(schema.songs).values({ artist, artistId, title, path: file.trim() }).onConflictDoNothing()
}

if (process.env.NODE_ENV === 'development') {
  for (let i = 1; i < 101; i++) {
    await db.insert(schema.history).values({ artistId: randomIntFromInterval(1, 10), songId: i }).onConflictDoNothing().returning()  
  }
}

await db.insert(schema.users).values({ username: 'Admin', name: 'Rádio Som do Mato', password: '123', email: 'somdomato@somdomato.com' }).onConflictDoNothing()

console.log('🌱 Seeding complete.')
