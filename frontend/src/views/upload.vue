<script setup lang="ts">
import { ref, computed } from 'vue'
// import { validUrl } from '@/utils'

const url = ref('')
const sended = ref(false)
const valid = ref(false)
const aviso = ref({
  show: false,
  title: '',
  message: ''
})

function validUrl() {
  try {
    const newUrl = new URL(url.value)
    return newUrl.protocol === 'http:' || newUrl.protocol === 'https:'
  } catch (err) {
    return false
  }
}


async function submit() {
  if ((!validUrl() || !url.value.includes('youtube.com')) || url.value === '' || url.value.length < 3) return

  sended.value = false

  const data = await fetch(
    `${import.meta.env.VITE_API_URL}/upload`,
    { 
      method: 'post',
      body: JSON.stringify({ url: url.value })
    }
  ).then(res => { 
    sended.value = false
    url.value = ''
    return res.json()
  })

  if (data) {
    aviso.value.show = true
    aviso.value.title = 'Obrigado!'
    aviso.value.message = 'Iremos analizar seu envio, e se for um envio válido será adicionado a rádio.'
  }
}
</script>
<template>
  <div class="my-3">
    <form class="mb-3" @submit.prevent="submit" v-if="!sended">
      <div class="mb-3">
        <label for="url" class="form-label">URL do Youtube</label>
        <input v-model="url" type="text" class="form-control" :class="{ 'disabled': sended }" id="url" />
      </div>
      <button type="submit" class="btn" :class="{ 'btn-secondary disabled': sended, 'btn-warning': !sended }">Enviar</button>
    </form> 
    
    <div class="alert alert-warning alert-dismissible fade show" role="alert" v-if="aviso.show">
      <strong>{{ aviso.title }}</strong> {{ aviso.message }}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" @click="sended = false ; aviso.show = false"></button>
    </div>
    <!-- <div>
      {{ progress }}
      <div class="progress" role="progressbar" aria-label="Animated striped example" aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 75%"></div>
      </div>
    </div> -->
  </div>
</template>