import { Hono } from 'hono'
import { addRequest, getRequest, listRequests } from '@/services/requests.services'

const app = new Hono()

app.post('', async (c) => {
  try {
    const { songId } = await c.req.json()
    const data = await addRequest(Number(songId))
    return c.json(data, 201)
  } catch (error) {
    return c.json({ message: 'Erro ao pedir música' }, 500)
  }
})

app.get(':id{[0-9]+}', async (c) => {
  const { id } = c.req.param()
  const data = await addRequest(Number(id))
  return c.json(data)
})

app.get('/get', async (c) => {
  const data = await getRequest()
  return c.json(data)
})

app.get('', async (c) => {
  const data = await listRequests()
  return c.json(data)
})

export { app as request }