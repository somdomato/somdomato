import { Hono } from 'hono'
const app = new Hono()

app.get('/', (c) => c.text('Hono!'))

export default {
  fetch: app.fetch,
  port: 3333
}