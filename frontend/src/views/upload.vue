<script setup lang="ts">
import { ref } from 'vue'
// import { Alert } from '@/components/alert.vue';

const url = ref('')
const sended = ref(false)

async function submit() {
  if (url.value === '' || url.value.length < 3) return

  await fetch(
    `${import.meta.env.VITE_API_URL}/upload`,
    { 
      method: 'post',
      body: JSON.stringify({ url: url.value })
    }
  )

  url.value = ''
}
</script>
<template>
  <div class="my-3">
    <form @submit.prevent="submit" v-if="!sended">
      <div class="mb-3">
        <label for="url" class="form-label">URL do Youtube</label>
        <input v-model="url" type="text" class="form-control" id="url">
      </div>
      <button type="submit" class="btn btn-primary">Enviar</button>
    </form> 
    
    <div class="alert alert-warning alert-dismissible fade show" role="alert" v-else>
      <strong>Obrigado!</strong> Iremos analizar seu envio, e se for um envio válido será adicionado a rádio.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
    <!-- <div>
      {{ progress }}
      <div class="progress" role="progressbar" aria-label="Animated striped example" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 75%"></div>
      </div>
    </div> -->
  </div>
</template>