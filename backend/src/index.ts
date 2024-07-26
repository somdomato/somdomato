import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { main, auth, radio, song, request, history, upload } from '@/routes'
import { addClient, removeClient, broadcast } from '@/utils/websocket'

const app = new Hono()
// const worker = new Worker('@/worker.ts')

// worker.postMessage('hello')
// worker.onmessage = event => {
//   console.log(event.data)
// }

app.use('*', cors())
app.route('/', main)
app.route('/auth', auth)
app.route('/radio', radio)
app.route('/song', song)
app.route('/request', request)
app.route('/history', history)
app.route('/upload', upload)

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
      // const socketId = Number(Bun.hash(String(Math.random()), 1234))
      ws.data = { socketId } // Inicializa ws.data
      console.log(`WebSocket connection opened: ${socketId}`)
      addClient(socketId, ws)
    },
    message(ws, message) {
      console.log(`Received ${message} from ${ws.data.socketId}`)
      broadcast(String(message))
    },
    close(ws) {
      console.log(`WebSocket connection closed: ${ws.data.socketId}`)
      removeClient(ws.data.socketId)
    }
  },
  port: 3333
})

console.log(`Server running at http://${server.hostname}:${server.port}`)