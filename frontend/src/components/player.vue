<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
// import type { Song } from '@/types'

const song = useSongStore()
const streamUrl = 'https://radio.somdomato.com'
const src = ref(`${streamUrl}/radio.mp3`)
const oggSrc = ref(`${streamUrl}/radio.ogg`)

// async function multiSongName() {
//   const { icestats: { source } } = await (await fetch(`${streamUrl}/json`)).json()
//   const result = source.find((item: Song) => item.genre.toLocaleLowerCase() === song.genre)
//   song.title = !result ? song.setTitle('Rádio Som do Mato') : result.title.normalize("NFD")  
// }

async function songName() {
  const { icestats: { source: { artist, title } } } = await (await fetch(`${streamUrl}/json`)).json()
  const normalizedTitle = `${artist.normalize('NFD')} - ${title.normalize('NFD')}`  
  if (!title || title === 'undefined' || title === '') {
    song.setTitle('Rádio Som do Mato')
  } else {
    song.setTitle(normalizedTitle)
  }
}

onMounted(async () => {
  const player = document.querySelector('audio') as HTMLAudioElement
  const restart = document.querySelector('.plyr__restart') as HTMLElement
  const sourceOgg = player.querySelector("source[type='audio/ogg']") as HTMLSourceElement
  const sourceMpeg = player.querySelector("source[type='audio/mp3']") as HTMLSourceElement

  restart.addEventListener('click', async () => {
    sourceMpeg.src = src.value
    sourceOgg.src = oggSrc.value
    player.load()
    player.play()
    await songName()
  })
  
  // reloadPlayer(player, source)
  await songName()
  
  setInterval(async () => {
    await songName()
  }, 10000)
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
        <source :src="oggSrc" type="audio/ogg" />
        <source :src type="audio/mp3" />
      </audio>
    </vue-plyr>
  </div>
</template>