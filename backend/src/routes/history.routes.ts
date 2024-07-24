import { Hono } from 'hono'
import { getHistory, addHistory } from '@/services/history.services'

const app = new Hono()

app.get(':id', async (c) => {
  const { id } = c.req.param()
  const data = await addHistory(Number(id))
  return c.text(JSON.stringify(data))
})

app.get('', async (c) => {
  const data = await getHistory()
  return c.text(JSON.stringify(data))
})

export { app as history }