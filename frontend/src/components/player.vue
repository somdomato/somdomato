<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
import type { Song } from '@/types'

const song = useSongStore()
const streamUrl = 'https://radio.somdomato.com'
const src = ref(`${streamUrl}/geral`)

async function reloadPlayer(player: HTMLAudioElement, source: HTMLSourceElement, genre: string) {
  const ts = +new Date()
  player.pause()
  source.src = `${streamUrl}/${genre}?ts=${ts}`
  player.load()
}

async function songName() {
  const { icestats: { source } } = await (await fetch('https://radio.somdomato.com/json')).json()
  const result = source.find((item: Song) => item.genre.toLocaleLowerCase() === song.genre)
  song.title = !result ? song.setTitle('Rádio Som do Mato') : result.title.normalize("NFD")  
}

onMounted(async () => {
  const player = document.querySelector('audio') as HTMLAudioElement
  const source = document.querySelector('source') as HTMLSourceElement
  const restart = document.querySelector('.plyr__restart') as HTMLElement

  restart.addEventListener('click', async () => {
    reloadPlayer(player, source, song.genre)
    player.play()
    await songName()
  })
  
  reloadPlayer(player, source, song.genre)
  await songName()
  
  setInterval(async () => {
    await songName()
  }, 10000)
})

watch(
  () => song.genre,
  () => {
    // const player = document.querySelector('audio') as HTMLAudioElement;
    
    reloadPlayer(document.querySelector('audio') as HTMLAudioElement, document.querySelector('source') as HTMLSourceElement, song.genre);
    
    (document.querySelector('audio') as HTMLAudioElement).addEventListener("canplay", (event) => {
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