<script setup lang="ts">
import { useSongStore } from '@/stores/song'
const song = useSongStore()
</script>
<template>
  <div class="sticky-top" style="background-color: #1E2326;">
    <nav class="py-1">
      <div class="container d-flex flex-wrap">
        <ul class="nav me-auto">
          <li class="nav-item">
            <a href="#" class="nav-link link-body-emphasis text-white px-2">
              <span class="badge text-bg-primary" v-if="song.genre.toLowerCase() === 'geral'">geral</span>
              <span class="badge text-bg-secondary" v-else-if="song.genre.toLowerCase() === 'modao'">modão</span>
              <span class="badge text-bg-success" v-else-if="song.genre.toLowerCase() === 'universitario'">universitário</span>
              <span class="badge text-bg-danger" v-else-if="song.genre.toLowerCase() === 'romantico'">romântico</span>
              <span class="badge text-bg-warning" v-else-if="song.genre.toLowerCase() === 'gaucha'">gaúcha</span>
              {{ song.title }}
            </a>
          </li>
        </ul>
        <ul class="nav">
          <li class="nav-item">
            <slot />
          </li>
        </ul>
      </div>
    </nav>
    <header class="py-2 text-white">
      <div class="container d-flex flex-wrap align-items-center justify-content-center">
        <a href="/" class="d-flex align-items-center mb-3 mb-lg-0 me-lg-auto text-white text-decoration-none">
          <img width="46" height="46" class="me-2" src="/images/logotipo.svg" alt="Som do Mato">
          <span class="fs-4">Som do Mato</span>
        </a>
        <form class="col-12 col-lg-auto mb-3 mb-lg-0" role="search">
          <input type="search" class="form-control shadow-none" placeholder="Pesquisar música ou artista..." aria-label="Pesquisar" />
        </form>
      </div>
    </header>
  </div>
</template>