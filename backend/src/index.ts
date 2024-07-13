import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { radio } from '@/routes/radio.routes'
// import { addClient, removeClient, broadcastMessage } from '@/utils/websocket'

const app = new Hono()

app.use('*', cors())

app.route('/radio', radio)

app.get('/', (c) => {
  return c.text('Som do Mato API')
})

app.notFound((c) => {
  return c.text('Rota não encontrada', 404)
})

const server = Bun.serve<{ socketId: number }>({
  fetch(req, server) {
    if (server.upgrade(req, { data: { socketId: Math.random() } })) {
      return
    }
    return app.fetch(req)
  },
  websocket: {
    open(ws) {
      const socketId = Math.random()
      ws.data = { socketId } // Inicializa ws.data
      // console.log(`WebSocket connection opened: ${socketId}`)
      // addClient(socketId, ws)
    },
    message(ws, message) {
      // console.log(`Received ${message} from ${ws.data.socketId}`)
      // broadcastMessage(String(message))
    },
    close(ws) {
      // console.log(`WebSocket connection closed: ${ws.data.socketId}`)
      // removeClient(ws.data.socketId)
    }
  },
  port: Bun.env.API_PORT
})

console.log(`Server running at http://localhost:${server.port}`)