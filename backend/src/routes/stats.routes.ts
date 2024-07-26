import { Hono } from 'hono'
import { stats } from '@/services/stats.services'

const app = new Hono()

app.get('', async c => {
  const data = await stats()
  return c.json(data, 200)    
})


export { app as stats }