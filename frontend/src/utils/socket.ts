import { useWebSocket } from '@vueuse/core'

export const { status: wsStatus, data: wsData, send, open, close } = useWebSocket('wss://ws.somdomato.com', {
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