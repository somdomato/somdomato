<script setup lang="ts">
import { ref } from 'vue'

const search = ref('')
const results = ref([])

async function submit() {
  if (search.value === '' || search.value.length < 3) return

  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/song/search`, { method: 'post', body: JSON.stringify({ term: search.value }) })).json()

  console.log(data)

}
</script>
<template>
  <div class="p-5 mb-4 bg-body-tertiary rounded-3">
    <form @submit.prevent="submit">
      <div class="mb-3">
        <label for="search" class="form-label">Música ou artista</label>
        <input type="search" class="form-control shadow-none" id="search" />
      </div>
      <button type="submit" class="btn btn-primary">Pesquisar</button>
    </form>
  </div>
</template>