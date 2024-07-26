<script setup lang="ts">
import Header from '@/components/header.vue'
import Player from '@/components/player.vue'
import Ultimas from '@/components/sidebar/ultimas.vue'
import Birds from '@/components/birds.vue'
import Proximas from '@/components/sidebar/proximas.vue'
import Artista from '@/components/sidebar/artista.vue'
import Chat from '@/components/chat.vue'
</script>
<template>
  <Header>
    <Player />
  </Header>
  <main class="flex-shrink-0">
    <div class="container">
      <div class="row m-2">
        <div class="col p-3">
          <img src="/images/logo.svg" class="img-fluid" alt="Rádio Som do Mato" />
          <birds />
        </div>  
      </div>
      <div class="row">
        <div class="col-md-9">
          <div class="row mb-3" v-if="$route.name === 'Home'">
            <div class="col-12">          
              <chat />
            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <div class="bg-body-tertiary rounded-3 p-5 mb-4">
                <slot />
              </div>
            </div>
          </div>
        </div> 
        <div class="col-md-3">
          <!-- <artista /> -->
          <proximas />
          <ultimas />
        </div>
      </div>
    </div>
  </main>
  <footer class="footer mt-auto py-3 bg-body-tertiary">
    <div class="container">
      <span class="text-body-secondary">Por amor à música sertaneja.</span>
    </div>
  </footer>
</template>