import { Hono } from 'hono'
import { getHistory } from '@/services/history.services'

const app = new Hono()

app.get('', async (c) => {
  const data = await getHistory()
  return c.text(JSON.stringify(data))
})

export { app as history }