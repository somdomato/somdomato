<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSongStore } from '@/stores/song'
import { useWebSocket } from '@vueuse/core'
import { push } from 'notivue'

const { status, data, send, open, close } = useWebSocket('wss://ws.somdomato.com', {
  heartbeat: true,
  autoReconnect: {
    retries: 99999,
    delay: 5000,
    onFailed() {
      alert('Failed to connect WebSocket after 3 retries')
    },
  },
})

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
  () => data,
  (newData) => {
    push.info(`PUSH: ${newData.value}`)
    const data = JSON.parse(newData.value)
    console.info(data)
    if (data.action === 'new-song') {
      song.setTitle(`${data.song.artist} - ${data.song.title}`) 
    }
  },
  { deep: true }
)

onMounted(async () => {

  

  // const ws = useWebSocket()

  // ws.socket.onmessage = (event) => {
  //   const data = JSON.parse(event.data)
  //   console.info(event.data)
  //   // push.success(`PUSH: ${event.data}`)
  //   push.info(`PUSH: ${data.action}`)

  //   if (data.action === 'new-song') {
  //     song.setTitle(`${data.song.artist} - ${data.song.title}`) 
  //   }
  // }

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
    
  // await songName()  
  // setInterval(async () => {
  //   await songName()
  // }, 5000)
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