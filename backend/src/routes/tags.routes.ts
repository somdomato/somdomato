import { Hono } from 'hono'
import { getTags } from '@/services/tags.services'

const app = new Hono()

const songsPath = Bun.env.SONGS_PATH

app.get('', async c => {
  // const { id } = c.req.param()
  const data = await getTags(songsPath + '/test.mp3')
  return c.json(data, 200)    
})


export { app as tags }