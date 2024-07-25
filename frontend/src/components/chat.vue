<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>
<template>
  <div class="card">
    <div class="card-header d-flex align-items-center justify-content-between">
      <h5 class="card-title mb-0">Bate-Papo</h5>
      <button class="btn btn-sm btn-danger" @click="open = !open" v-if="open">Fechar</button>
    </div>
    <div class="d-flex align-items-center justify-content-center card-body p-0" style="min-height: 500px;">
      <div class="chat-container" v-if="open"> 
        <iframe class="chat-iframe" src="https://chat.somdomato.com" />
      </div>
      <div class="d-flex flex-column align-items-center justify-content-center" v-else>
        <img class="img-fluid" src="/images/logo-v2.svg" alt="Rádio Som do Mato" />
        <button class="btn btn-lg btn-danger mt-2" @click="open = !open">Entrar no Bate-Papo</button>
      </div>
    </div>
  </div>
</template>