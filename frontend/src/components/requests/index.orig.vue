<script setup lang="ts">
import { ref } from 'vue'
import { push } from 'notivue'
import Pagination from '@/components/pagination.vue'
import type { Song } from '@/types'

const term = ref('')
const aviso = ref('')
const songs = ref<Song[]>([])
const current = ref(1)
const pages = ref(0)
const total = ref(0)
const pageSize = 2

async function handlePageChange(page: number) {
  current.value = page
  await search(page)
}

async function request(songId: number, artist = '', title = '', artistId: number | null = null) {
  if (!songId) return
  
  const data = await (await fetch(
    `${import.meta.env.VITE_API_URL}/request`, { 
      method: 'post', 
      body: JSON.stringify({ songId, artistId }) 
    }
  )).json()
  
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

async function search(page = 1) {
  if (term.value === '' || term.value.length < 3) return
  
  const data = await (await fetch(
    `${import.meta.env.VITE_API_URL}/song/search?page=${page}&pageSize=${pageSize}`,  
    { 
      method: 'post', 
      body: JSON.stringify({ term: term.value }) 
    }
  )).json()

  if (data.pages) pages.value = data.pages
  if (data.total) total.value = data.total
  
  if (data && data.songs && data.songs.length > 0) {
    songs.value = data.songs
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
      <input v-model="term" type="search" class="form-control shadow-none" id="search" @keyup.enter.prevent="search()" />
    </div>
    <button class="btn btn-primary me-2" @click.prevent="search()">Pesquisar</button>
    <button class="btn btn-danger" @click.prevent="term = '' ; songs = [] ; aviso = ''">Limpar</button>
    <div class="mt-3" v-if="aviso">
      <div class="alert alert-warning alert-dismissible fade show" role="alert" v-html="aviso"></div>
    </div>
    <div>
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
          <tr v-for="(song, index) in songs" :key="song.id">
            <th scope="row">{{ index }}</th>
            <td>{{ song.artist }}</td>
            <td>{{ song.title }}</td>
            <td>
              <button class="btn btn-sm btn-outline-success" @click="request(song.id, song.artist, song.title, song?.artistId)">Pedir</button>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
      <pagination :current="current" :total="pages" @change="handlePageChange" />
    </div>
  </div>
</template>
