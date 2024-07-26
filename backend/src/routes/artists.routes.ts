import { Hono } from 'hono'
import { getArtist } from '@/services/artists.services'

const app = new Hono()

app.get(':id', async c => {
  const { id } = c.req.param()
  const data = await getArtist(Number(id))
  return c.json(data, 200)    
})


export { app as artist }