<script setup lang="ts">
import { ref } from 'vue'
import { push } from 'notivue'
import { useSongStore } from '@/stores/song'
import type { Song } from '@/types'

const songStore = useSongStore()
const term = ref('')
const aviso = ref('')
const songs = ref<Song[]>([])

async function request(id: number, artist = '', title = '') {
  if (!id) return
  
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/request`, { method: 'post', body: JSON.stringify({ songId: id }) })).json()
  
  if (data && data.ok) {
    push.success(`Você acabou de pedir a música ${title} - ${artist}\n\nObrigado!`)
    songs.value = []
  } else if (data && !data.ok && data.message) {
    push.error(data.message)
  } else {
    push.error('Erro ao pedir música')
    songs.value = []
  }
    
  setTimeout(() => { aviso.value = '' }, 5000)
}

async function search() {
  if (term.value === '' || term.value.length < 3) return
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/song/search`, { method: 'post', body: JSON.stringify({ term: term.value }) })).json()
  
  if (data && data.songs && data.songs.length > 0) {
    songs.value = data.songs
    term.value = ''
  } else {
    aviso.value = 'Nenhuma música encontrada'
    songs.value = []
  }  
}
</script>
<template>
  <div>
    <div class="mb-3 pedidos">
      <label for="search" class="form-label">Música ou artista</label>
      <input v-model="term" type="search" class="form-control shadow-none" id="search" @keyup.enter.prevent="search" />
    </div>

    <button class="btn btn-primary me-2" @click.prevent="search">Pesquisar</button>
    <button class="btn btn-danger" @click.prevent="term = '' ; songs = [] ; aviso = ''">Limpar</button>
        
    <div class="mt-3">
      <div class="alert alert-warning alert-dismissible fade show" role="alert" v-if="aviso" v-html="aviso"></div>
    </div>
    
    <div v-if="songs.length > 0">
      <div class="table-responsive">
        <table class="table">
          <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Artista</th>
            <th scope="col">Música</th>
            <th scope="col">Pedir</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(song, index) in songs">
            <th scope="row">{{ index }}</th>
            <td>{{ song.artist }}</td>
            <td>{{ song.title }}</td>
            <td>
              <button class="btn btn-sm btn-outline-success" @click="request(song.id, song.artist, song.title)">Pedir</button>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>