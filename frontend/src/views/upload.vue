<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { push } from 'notivue'
import { useWebSocket } from '@/composables/websocket'

const ws = useWebSocket()
const url = ref('')
const progress = ref('Progresso')

async function submit() {
  if (url.value === '' || url.value.length < 3) return

  await (await fetch(
    `${import.meta.env.VITE_API_URL}/upload`,
    { 
      method: 'post',
      body: JSON.stringify({ url: url.value })
    }
  ))

  url.value = ''
}

onMounted(() => {
  ws.socket.onmessage = async (event) => {
    const data = JSON.parse(event.data)
    console.log(JSON.stringify(data))
    if (data.action === 'upload') {
      // progress.value = JSON.stringify(data)
      push.success(`Upload`)
    }
  } 
})
</script>
<template>
  <div class="my-3">
    <form @submit.prevent="submit">
      <div class="mb-3">
        <label for="url" class="form-label">URL do Youtube</label>
        <input v-model="url" type="text" class="form-control" id="url">
      </div>
      <button type="submit" class="btn btn-primary">Submit</button>
    </form>  
    <div>
      {{ progress }}
      <div class="progress" role="progressbar" aria-label="Animated striped example" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 75%"></div>
      </div>
    </div>
  </div>
</template>