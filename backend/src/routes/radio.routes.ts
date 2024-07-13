import { Hono } from 'hono'
import { getRandomFile } from '@/services/radio.services'

const app = new Hono()

app.get('/:genre?', async (c) => {
  const { genre } = c.req.param()
  const song = await getRandomFile(genre ?? '/')
  return c.text(song)
})

export { app as radio }