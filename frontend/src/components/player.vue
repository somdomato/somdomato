<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
import type { Song } from '@/types'

const song = useSongStore()
const streamUrl = 'https://radio.somdomato.com'
const src = ref(`${streamUrl}/radio.ogg`)

async function reloadPlayerGenre(player: HTMLAudioElement, source: HTMLSourceElement, genre: string) {
  player.pause()
  source.src = `${streamUrl}/${genre}?ts=${+new Date()}`
  player.load()
}

async function reloadPlayer(player: HTMLAudioElement, source: HTMLSourceElement) {
  player.pause()
  source.src = `${streamUrl}/radio.ogg?ts=${+new Date()}`
  player.load()
}

async function multiSongName() {
  const { icestats: { source } } = await (await fetch(`${streamUrl}/json`)).json()
  const result = source.find((item: Song) => item.genre.toLocaleLowerCase() === song.genre)
  song.title = !result ? song.setTitle('Rádio Som do Mato') : result.title.normalize("NFD")  
}

async function songName() {
  const { icestats: { source: { title } } } = await (await fetch(`${streamUrl}/json`)).json()
  song.title = title === '' ? song.setTitle('Rádio Som do Mato') : title.normalize('NFD')  
}

onMounted(async () => {
  const player = document.querySelector('audio') as HTMLAudioElement
  const source = document.querySelector('source') as HTMLSourceElement
  const restart = document.querySelector('.plyr__restart') as HTMLElement

  restart.addEventListener('click', async () => {
    reloadPlayer(player, source)
    player.play()
    await songName()
  })
  
  reloadPlayer(player, source)
  await songName()
  
  setInterval(async () => {
    await songName()
  }, 10000)
})

watch(
  () => song.genre,
  () => {
    reloadPlayer(document.querySelector('audio') as HTMLAudioElement, document.querySelector('source') as HTMLSourceElement);
    
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