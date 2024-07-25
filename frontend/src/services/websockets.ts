import { useWebSocket } from '@vueuse/core'
import { ref } from 'vue'
import type { WebSocketEvent } from '@/types'

const event = ref<WebSocketEvent | null>(null)

// const { data } = useWebSocket('wss://ws.somdomato.com', {
const { data } = useWebSocket(`${import.meta.env.VITE_WS_URL}`, {
  heartbeat: true,
  autoReconnect: {
    retries: 99999,
    delay: 5000,
    onFailed() {
      alert('Failed to connect WebSocket after 3 retries')
    },
  },
})

data.value?.then((res: WebSocketEvent | null) => {
  event.value = res
})

export function useWebSocketService() {
  return { event }
}
