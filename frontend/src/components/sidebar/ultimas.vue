<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Notivue, Notification, push } from 'notivue'

const last = ref([])

onMounted(() => {
  // const socket = new WebSocket(import.meta.env.VITE_WS_URL)
  const socket = new WebSocket('wss://ws.somdomato.com')
  
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data)
    if (data.action === 'new-song') {
      push.success('Uma nova música está tocando!!!')
      console.log(data.song)
    }
  } 
})
</script>
<template>
  <div class="card mb-3">
    <div class="card-header">
      <h5 class="card-title">Últimas músicas</h5>
    </div>
    <ul class="list-group list-group-flush">
      <li class="list-group-item">Musica</li>
    </ul>
  </div> 
</template>