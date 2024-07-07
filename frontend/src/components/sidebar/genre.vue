<script setup lang="ts">
import { ref } from 'vue'
import { useSongStore } from '@/stores/song'

const song = useSongStore()
const genre = ref('geral')
</script>
<template>
  <div class="card mb-3">
    <div class="card-header">
      <h5 class="card-title">Estilo</h5>
    </div>
    <div class="card-body">
      <select v-model="genre" class="form-select form-select-sm shadow-none" aria-label="Gênero" @change="song.setGenre(genre)">
        <option value="geral" selected>Geral</option>
        <option value="modao">Modão</option>
        <option value="universitario">Universitário</option>
        <option value="romantico">Romântico</option>
        <option value="gaucha">Gaúcha</option>
      </select>    
    </div>
  </div> 
</template>