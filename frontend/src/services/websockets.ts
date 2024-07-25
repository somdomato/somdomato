// import { ref } from 'vue'
import { useWebSocket, type UseWebSocketReturn } from '@vueuse/core'
import type { WebSocketEvent } from '@/types'

// const data = ref<WebSocketEvent | null>(null)

const webSocket: UseWebSocketReturn<WebSocketEvent> = useWebSocket('wss://ws.somdomato.com', {
  heartbeat: true,
  autoReconnect: {
    retries: 99999,
    delay: 5000,
    onFailed() {
      alert('Failed to connect WebSocket after 3 retries')
    },
  },
})

export function useWebSocketService() {
  return { ...webSocket }
}
