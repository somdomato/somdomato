import { Hono } from 'hono'
import { findSong } from '@/services/songs.services'

const app = new Hono()

app.post('/search', async (c) => {
  try {
    const { term } = await c.req.json()
    const data = await findSong(term)
    return c.json(data)
  } catch (error) {
    return c.json({ message: 'Erro ao pesquisar músicas' }, 500)
  }
})

export { app as song }