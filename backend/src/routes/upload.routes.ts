import { Hono } from 'hono'
import { downloadSong } from '@/services/upload.services'

const app = new Hono()

app.post('', async (c) => {
  try {
    const { url } = await c.req.json()
    const data = await downloadSong(url)
    return c.json(data, 200)
  } catch (error) {
    return c.text('Erro ao baixar música:' + error, 500)
  }
})

export { app as upload }