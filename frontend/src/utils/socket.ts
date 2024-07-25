import { useWebSocket } from '@vueuse/core'

//const url = 'wss://ws.somdomato.com'
const url = import.meta.env.VITE_WS_URL as string

export const { status, data, send, open, close } = useWebSocket(url, {
  autoReconnect: {
    retries: 30,
    delay: 3000,
    onFailed() {
      alert('Failed to connect WebSocket after 30 retries')
    },
  },
  heartbeat: {
    message: 'ping',
    interval: 1000,
    pongTimeout: 1000,
  }
})