import { Hono } from 'hono'
import { findSong } from '@/services/songs.services'

const app = new Hono()

app.post('/search', async (c) => {
  try {
    const page = Number.parseInt(c.req.query('page') || '1', 10)
    const pageSize = Number.parseInt(c.req.query('pageSize') || '10', 10)
    const { term } = await c.req.json()
    const data = await findSong(term, page, pageSize)
    return c.json(data)
  } catch (error) {
    return c.json({ message: 'Erro ao pesquisar músicas' }, 500)
  }
})

export { app as song }