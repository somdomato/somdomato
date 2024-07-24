<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'

const song = useSongStore()
const streamUrl = 'https://radio.somdomato.com'
const src = ref(`${streamUrl}/radio.mp3?ts=${+new Date()}`)

async function songName() {
  const { icestats: { source: { title } } } = await (await fetch(`${streamUrl}/json`)).json()
  if (!title || title === '' || title === 'undefined') {
    song.setTitle('Rádio Som do Mato')
  } else {
    song.setTitle(title.normalize('NFD'))
  }
}

onMounted(async () => {
  const player = document.querySelector('audio') as HTMLAudioElement
  const restart = document.querySelector('.plyr__restart') as HTMLElement
  const toggle = document.querySelector('[data-plyr=play]') as HTMLElement
  // const sourceMpeg = player.querySelector("source[type='audio/mp3']") as HTMLSourceElement
  
  toggle.addEventListener('click', async (event) => {
    event.preventDefault()
    src.value = `${streamUrl}/radio.mp3?ts=${+new Date()}`
    player.load()

    if (toggle.getAttribute('aria-pressed') === 'false') {
      player.play()
    }
  })

  restart.addEventListener('click', async () => {
    player.load()
    src.value = `${streamUrl}/radio.mp3?ts=${+new Date()}`
    player.play()
    await songName()
  })
    
  await songName()
  
  setInterval(async () => {
    await songName()
  }, 5000)
})

watch(
  () => song.genre,
  () => {
    // reloadPlayer(document.querySelector('audio') as HTMLAudioElement, document.querySelector('source') as HTMLSourceElement);
    
    (document.querySelector('audio') as HTMLAudioElement).addEventListener("canplay", () => {
      (document.querySelector('audio') as HTMLAudioElement).play();
    });
  }
)
</script>
<template>
  <div class="d-md-flex align-items-center justify-content-between">
    <vue-plyr ref="plyr">
      <audio controls crossorigin="true" playsinline data-plyr-config='{ "tooltips": { "controls": "false", "seek": "false" } }'>
        <source :src type="audio/mp3" />
      </audio>
    </vue-plyr>
  </div>
</template>