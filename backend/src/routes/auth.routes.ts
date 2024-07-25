import { Hono } from 'hono'
import { signin, signup } from '@/services/auth.services'

const app = new Hono()

app.post('/signin', async c => {
  try {
    const { identifier, password } = await c.req.json()
    const data = await signin(identifier, password)
    return c.json(data, 200)    
  } catch (error) {
    return c.json({ message: 'Erro ao fazer login', ok: false }, 400)    
  }
})

app.post('/signup', async c => {
  try {
    const { username, email, password } = await c.req.json()
    const data = await signup(username, email, password)
    return c.json(data, 201)    
  } catch (error) {
    return c.json({ message: 'Erro ao fazer login', ok: false }, 400)
  }
})

export { app as auth }