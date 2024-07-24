<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { push } from 'notivue'
import type { History } from '@/types'

const history = ref<History[]>([])

async function getLastSongs() {
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/history`)).json()
  history.value = data
}

onMounted(() => {
  getLastSongs()

  const socket = new WebSocket(import.meta.env.VITE_WS_URL)
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data)
    if (data.action === 'new-song') {
      push.success('Uma nova música está tocando!!!')
      getLastSongs()
    }
  } 
})
</script>
<template>
  <div class="card mb-3">
    <div class="card-header">
      <h5 class="card-title">Últimas músicas</h5>
    </div>
    <ul class="list-group list-group-flush" v-if="history && history.length > 0">
      <li class="list-group-item border-0 text-truncate" v-for="(hist, index) in history">{{ index+1 }} - {{ hist.song.artist }} - {{ hist.song.title }}</li>
    </ul>
  </div> 
</template>