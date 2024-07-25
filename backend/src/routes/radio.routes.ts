import { Hono } from 'hono'
import { getSong } from '@/services/radio.services'

const app = new Hono()

app.get('', async (c) => {
  const song = await getSong()
  return c.text(song)
})

export { app as radio }