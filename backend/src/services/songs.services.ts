import { db } from '@/drizzle'
import { eq, desc, or, like, count } from 'drizzle-orm'
import * as schema from '@/drizzle/schema'
import { basename, parse } from 'node:path'
import { timeDiffMinutes } from '@/utils/time'

export async function addSong(path: string, rotation = 'normal', enabled = true) {
  const filename = parse(basename(path)).name
  const title = filename.split('-').pop()
  const artist = filename.split('-')[0]
  const songData = { artist: artist.trim(), title: title?.trim() || '', path: path.trim(), enabled, rotation }
  await db.insert(schema.songs).values(songData).onConflictDoNothing()
}

export async function getSong(id: number) {
  const [song] = await db.select()
    .from(schema.songs)
    .where(eq(schema.songs.id, id)).limit(1)

  if (!song) return null

  return song
}

export const searchSongs = async (term: string, page = 1, pageSize = 10) => {
  const offset = (page - 1) * pageSize
  
  const [totalResults] = await db.select({ count: count() }).from(schema.songs).where(
    or(
      like(schema.songs.artist, `%${term}%`),
      like(schema.songs.title, `%${term}%`)
    )
  )

  const results = await db.query.songs.findMany({
    where: (s, { or, like }) => (
      or(
        like(s.artist, `%${term}%`),
        like(s.title, `%${term}%`)
      )
    ),
    orderBy: (song, { asc }) => [asc(song.artist), asc(song.title)],
    limit: pageSize,
    offset: offset
  })

  const total = totalResults.count
  const pages = Math.ceil(total / pageSize)

  return { songs: results, pages, total }
}

export async function playedAt(songId: number) {
  const [data] = await db.select()
    .from(schema.songs)
    .where(eq(schema.songs.id, songId))
    .orderBy(desc(schema.songs.playedAt))
    .limit(1)

  return data.playedAt ? timeDiffMinutes(data.playedAt) : null
}