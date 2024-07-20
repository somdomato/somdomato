import { Hono } from 'hono'
import { getRandomSong, getRandomSongGenre } from '@/services/radio.services'

const app = new Hono()

app.get('', async (c) => {
  const song = await getRandomSong()
  return c.text(song)
})

app.get(':genre', async (c) => {
  const { genre } = c.req.param()
  const song = await getRandomSongGenre(genre)
  return c.text(song)
})

export { app as radio }