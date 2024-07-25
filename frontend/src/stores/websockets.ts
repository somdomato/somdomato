// stores/webSocketStore.ts
import { defineStore } from 'pinia'
import { useWebSocketService } from '@/services/websockets'

export const useWebSocketStore = defineStore('webSocket', () => {
  const webSocketService = useWebSocketService()
  return { ...webSocketService }
})