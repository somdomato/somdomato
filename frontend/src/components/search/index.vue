<script setup lang="ts">
import { ref } from 'vue'

const search = ref('')

function submit() {
  if (search.value === '' || search.value.length < 3) return

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