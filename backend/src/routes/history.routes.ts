import { Hono } from 'hono'
import { getHistory, addHistory, getHistBySong, getHistByArtist } from '@/services/history.services'

const app = new Hono()

// app.get(':id', async (c) => {
//   const { id } = c.req.param()
//   const data = await addHistory(Number(id))
//   return c.json(data)
// })

app.get('/song/:song', async (c) => {
  const { song } = c.req.param()
  const data = await getHistBySong(Number(song))
  return c.json(data)
})

app.get('/artist/:song', async (c) => {
  const { song } = c.req.param()
  const data = await getHistByArtist(Number(song))
  return c.json(data)
})

app.get('', async (c) => {
  const data = await getHistory()
  return c.json(data)
})

export { app as history }