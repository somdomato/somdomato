<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
import { push } from 'notivue'
import { useWebSocketStore } from '@/stores/socket'

const socket = useWebSocketStore()
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

watch(
  () => socket.data,
  (data) => {
    push.info(`PUSH: ${data.song}`)

    // action: "new-request",
    // "song": { "message": "Música encontrada", "song":{"id":48,"artist":"Marilia Mendonca","title":"Como Faz Com Ela","path":"/media/songs/uni/marilia_mendonca/Marilia Mendonca - Como Faz Com Ela.mp3","genre":"Sertanejo","likes":0,"enabled":true,"rotation":"normal"},"ok":true}}

    // const data = JSON.parse(event)
    console.info(data)
    // if (data.action === 'new-song') {
      songName()
      song.setTitle(`${data.song.artist} - ${data.song.title}`) 
    // }
  },
  { deep: true }
)

// watch([x, () => y.value], ([newX, newY]) => {
//   console.log(`x is ${newX} and y is ${newY}`)
// })

onMounted(async () => {
  const player = document.querySelector('audio') as HTMLAudioElement
  const restart = document.querySelector('.plyr__restart') as HTMLElement
  const toggle = document.querySelector('[data-plyr=play]') as HTMLElement
  
  toggle.addEventListener('click', async (event) => {
    event.preventDefault()
    src.value = `${streamUrl}/radio.mp3?ts=${+new Date()}`
    player.load()
    
    if (toggle.getAttribute('aria-pressed') === 'false') {
      player.play()
    }
    await songName()
  })

  restart.addEventListener('click', async () => {
    player.load()
    src.value = `${streamUrl}/radio.mp3?ts=${+new Date()}`
    player.play()
    await songName()
  })
})

// watch(
//   () => song.genre,
//   () => {
//     // reloadPlayer(document.querySelector('audio') as HTMLAudioElement, document.querySelector('source') as HTMLSourceElement);
    
//     (document.querySelector('audio') as HTMLAudioElement).addEventListener("canplay", () => {
//       (document.querySelector('audio') as HTMLAudioElement).play();
//     });
//   }
// )
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