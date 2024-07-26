<script setup lang="ts">
import { ref, watch } from 'vue'
import type { History } from '@/types'
import { data } from '@/utils/socket'

const url = 'https://api.somdomato.com'
//const url = import.meta.env.VITE_API_URL
const history = ref<History[]>([])

async function getLastSongs() {
  const data = await (await fetch(`${url}/history`)).json()
  history.value = data
}

watch(
  () => data,
  (newdata) => {
    if (newdata.value) {
      const json = JSON.parse(newdata.value)
      if (json.action === 'new-song') {
        getLastSongs()    
      }
    }
  },
  { deep: true }
)
</script>
<template>
  <div class="card mb-3">
    <div class="card-header">
      <h5 class="card-title">Sobre o Artista</h5>
    </div>
    <div class="card-body">
      <h5 class="card-title">Special title treatment</h5>
      <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
      <a href="#" class="btn btn-primary">Go somewhere</a>
    </div>
    <div class="card-footer text-body-secondary">
      2 days ago
    </div>
  </div> 
</template>