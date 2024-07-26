import { Hono } from 'hono'
import { getHistory } from '@/services/history.services'

const app = new Hono()

app.get('', async (c) => {
  const data = await getHistory()
  return c.json(data)
})

export { app as history }