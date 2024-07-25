import { ref, computed, onMounted } from 'vue'
import { defineStore } from 'pinia'
import { useWebSocket } from '@vueuse/core'
// import type { WebSocketStatus } from '@vueuse/core'

export const useWebSocketStore = defineStore('websocket', () => {
  const { status, data, send, open, close } = useWebSocket('wss://ws.somdomato.com', {
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

  return { status, data, send, open, close }
})
