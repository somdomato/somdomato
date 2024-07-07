import { db } from '@/drizzle'
import { eq, sql } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { Glob } from 'bun'
import { basename, parse } from 'node:path'
// import fg from 'fast-glob'

const genre = Bun.argv[2] || 'Sertanejo'
const songsPath = Bun.env.SONGS_PATH
let song: string | null

// function randomFile(genre: string): string {
//   const scanPath = genre === 'g' ? `${songsPath}/**/*.mp3` : `${songsPath}/${genre}/**/*.mp3`
//   const files = fg.globSync(scanPath, { absolute: true })
//   const index = Math.round(Math.random() * (files.length - 1))
//   return files[index]
// }

async function getRandomSong(genre = 'Sertanejo') {
  const [song] = await db.select()
    .from(schema.songs)
    .where(eq(schema.songs.genre, genre))
    .orderBy(
      sql`RANDOM()`
    )
    .limit(1)

  if (!song) return null
  return song.path
}

async function getRandomFile() {
  const glob = new Glob("**/*.mp3")
  const files = []

  for await (const file of glob.scan(songsPath)) {
    const filename = parse(basename(file)).name
    const title = filename.split('-').pop()
    const artist = filename.split('-')[0]
    files.push({ artist: artist.trim(), title: title?.trim() || '', path: `${songsPath}/${file}` })
  }

  return files[Math.floor(Math.random() * files.length)].path
}

song = await getRandomSong(genre)
if (!song) song = await getRandomFile()

Bun.write(Bun.stdout, song)