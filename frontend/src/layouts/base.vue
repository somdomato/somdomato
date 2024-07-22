<script setup lang="ts">
import Header from '@/components/header.vue'
import Player from '@/components/player.vue'
import Ultimas from '@/components/sidebar/ultimas.vue'
import Estilo from '@/components/sidebar/genre.vue'
</script>
<template>
  <Header>
    <Player />
  </Header>
  <main class="flex-shrink-0">
    <div class="container">
      <div class="row m-3">
        <div class="col p-5">
          <img src="/images/logo.svg" class="img-fluid" alt="Rádio Som do Mato" />
        </div>  
      </div>
      <div class="row">
        <div class="col-md-9">
          <div class="row mb-3">
            <div class="col-12">
          
              <div class="card">
                <div class="card-header">
                  <h5 class="card-title">Bate-Papo</h5>
                </div>
                <div class="card-body p-0">
                  <div class="chat-container"> 
                    <iframe class="chat-iframe" src="https://chat.somdomato.com" />
                  </div>
                </div>
              </div> 

            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <slot />
            </div>
          </div>
        </div> 
        <div class="col-md-3">
          <Estilo />
          <Ultimas />
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