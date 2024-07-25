<script setup lang="ts">
import { ref, watch } from 'vue'
import type { History } from '@/types'
import { data } from '@/utils/socket'

const history = ref<History[]>([])

async function getLastSongs() {
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/history`)).json()
  history.value = data
}

watch(
  () => data,
  (newdata) => {
    console.info('From HISTORY', newdata.value)
    if (newdata.value.action === 'new-song') {
      getLastSongs()    
    }
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