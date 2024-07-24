<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { push } from 'notivue'
import type { History } from '@/types'

const nextSongs = ref<History[]>([])

async function getNextSongs() {
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/request`)).json()
  nextSongs.value = data
}

onMounted(() => {
  getNextSongs()
  
  const socket = new WebSocket(import.meta.env.VITE_WS_URL)
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data)
    if (data.action === 'new-request') {
      push.success(`Um novo pedido foi feito.`)
      getNextSongs()
    }
  } 
})
</script>
<template>
  <div class="card mb-3" v-if="nextSongs && nextSongs.length > 0">
    <div class="card-header">
      <h5 class="card-title">Próximas</h5>
    </div>
    <ul class="list-group list-group-flush">
      <li class="list-group-item border-0 text-truncate" v-for="(next, index) in nextSongs">{{ index+1 }} - {{ next.song.artist }} - {{ next.song.title }}</li>
    </ul>
  </div> 
</template>