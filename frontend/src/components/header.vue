<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
import Icon from '@/components/icon.vue'

const term = ref('')
const song = useSongStore()


// import { ref } from 'vue'

// // Here's our template ref typed as HTMLElement or null
// const pedidos = ref<HTMLElement | null>(null)

// // Using scrollIntoView() function to achieve the scrolling
// function scrollTo(view: Ref<HTMLElement | null>) { 
//   view.value?.scrollIntoView({ behavior: 'smooth' }) 
// }

function share() {
  const msg = encodeURIComponent(`Ouça ${song.title} na Rádio Som do Mato!\n\nhttps://somdomato.com`)
  const url = `https://wa.me/?text=${msg}`
  return url
}

function search() {
  const pedidos = document.querySelector(".pedidos") as HTMLElement | null
  if (term.value === '' || term.value.length < 3) return
  song.setRequest(term.value)
  if (pedidos) scrollTo(pedidos)
}

function scrollTo(el: HTMLElement | null) { 
  el?.scrollIntoView({ behavior: 'smooth' }) 
}

onMounted(() => {
  

// element.scrollIntoView();
// element.scrollIntoView(false);
// element.scrollIntoView({ block: "end" });
// pedidos.scrollIntoView({ block: "end", behavior: "smooth" });

})
</script>
<template>
  <div class="sticky-top" style="background-color: #1E2326;">
    <nav class="py-1">
      <div class="container d-flex flex-wrap">
        <ul class="nav me-auto">
          <li class="nav-item">
            <div class="d-flex align-items-center">
              <span class="d-inline-block text-truncate nav-link text-white fw-light fst-italic py-1" style="max-width: 70vw;">
                {{ song.title }}
              </span>

              <!-- <span v-popover data-bs-trigger="hover focus" :data-bs-content="song.title"> -->
                <a class="-mt-3" :href="share()" target="_blank">
                  <icon name="whatsapp" class="text-secondary"  />
                </a>
              <!-- </span> -->
            </div>
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
        <div class="col-12 col-lg-auto mb-3 mb-lg-0">
          <input v-model="term" type="search" class="form-control shadow-none" placeholder="Pesquisar música ou artista..." aria-label="Pesquisar" @keyup.enter.prevent="search" />
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