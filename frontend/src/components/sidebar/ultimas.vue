<script setup lang="ts">
import { ref, watch } from 'vue'
import type { History } from '@/types'
import { useWebSocketStore } from '@/stores/websockets'

const { data, send, status, close, open } = useWebSocketStore()

// import { useWebSocket } from '@vueuse/core'

// const { data: event } = useWebSocket('wss://ws.somdomato.com', {
//   heartbeat: true,
//   autoReconnect: {
//     retries: 99999,
//     delay: 5000,
//     onFailed() {
//       alert('Failed to connect WebSocket after 3 retries')
//     },
//   },
// })

const history = ref<History[]>([])

async function getLastSongs() {
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/history`)).json()
  history.value = data
}

// watch(data, (data) => {
//   console.log('History', data.value)
// }, { deep: true })

watch(
  () => data,
  (newEvent) => {
    // const data = JSON.parse(newEvent)
    console.info(data)
    
    // if (data.action === 'new-song') {
    //   getLastSongs()
    // }
  },
  { deep: true }
)
</script>
<template>
  <div class="card mb-3" v-if="history && history.length > 0">
    <div class="card-header">
      <h5 class="card-title">Últimas músicas</h5>
    </div>
    <ul class="list-group list-group-flush">
      <li class="list-group-item border-0 text-truncate" v-for="(hist, index) in history">{{ index+1 }} - {{ hist.song.artist }} - {{ hist.song.title }}</li>
    </ul>
  </div> 
</template>