import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Som do Mato API')
})

app.notFound((c) => {
  return c.text('Rota não encontrada', 404)
})

export { app as main }