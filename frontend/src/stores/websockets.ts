import { defineStore } from 'pinia'
import { useWebSocketService } from '@/services/websockets'

export const useWebSocketStore = defineStore('webSocket', () => {
  const { data } = useWebSocketService()
  return { data }
})
