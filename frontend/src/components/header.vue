<script setup lang="ts">
import { ref } from 'vue'
import { useSongStore } from '@/stores/song'
import Info from '@/components/info.vue'

const term = ref('')
const song = useSongStore()
</script>
<template>
  <div class="sticky-top header">
    <nav class="py-1">
      <div class="container d-flex flex-wrap">
        <ul class="nav mx-auto mx-md-0 me-md-auto">
          <li class="nav-item">
            <info :song="song.title" />
          </li>
        </ul>
        <ul class="nav mx-auto mx-md-0 ms-md-auto">
          <li class="nav-item">            
            <slot />
          </li>
        </ul>
      </div>
    </nav>
    <header class="py-2 text-white">
      <div class="container d-flex flex-wrap align-content-center justify-content-center">
        <router-link to="/" class="d-flex align-items-center align-content-center mb-3 mb-lg-0 me-lg-auto text-white text-decoration-none">
          <img width="46" height="46" class="me-2" src="/images/logotipo.svg" alt="Som do Mato">
          <span class="fs-4">Som do Mato</span>
        </router-link>
        <div class="col-12 col-lg-auto mb-3 mb-lg-0 text-center">
          <router-link to="/entrar" class="btn btn-outline-light me-2">Entrar</router-link>
          <router-link to="/cadastro" class="btn btn-warning">Cadastro</router-link>
        </div>
      </div>
    </header>
  </div>
</template>
<style>
svg {
  cursor: pointer;
}
</style>