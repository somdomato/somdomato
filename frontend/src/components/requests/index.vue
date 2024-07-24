<script setup lang="ts">
import { ref } from 'vue'
import { push } from 'notivue'
import type { Song } from '@/types'

const term = ref('')
const aviso = ref('')
const songs = ref<Song[]>([])

async function request(id: number, artist = '', title = '') {
  if (!id) return
  
  await (await fetch(`${import.meta.env.VITE_API_URL}/request/add`, { method: 'post', body: JSON.stringify({ songId: id }) })).json()

  push.success(`Você acabou de pedir a música <strong>${title}</strong> de <strong>${artist}</strong>`)

  aviso.value = `
    <h3>Parabéns!</h3> Você acabou de pedir a música <strong>${title}</strong> de <strong>${artist}</strong> e em breve ela tocará na rádio!
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `
  songs.value = []

  setTimeout(() => { aviso.value = '' }, 5000)
}

async function search() {
  if (term.value === '' || term.value.length < 3) return
  const data = await (await fetch(`${import.meta.env.VITE_API_URL}/song/search`, { method: 'post', body: JSON.stringify({ term: term.value }) })).json()
  if (data) songs.value = data.songs
  term.value = ''
}
</script>
<template>
  <div class="p-5 mb-4 bg-body-tertiary rounded-3">
    <div class="mb-3">
      <label for="search" class="form-label">Música ou artista</label>
      <input v-model="term" type="search" class="form-control shadow-none" id="search" @keyup.enter.prevent="search" />
    </div>
    <button class="btn btn-primary" @click.prevent="search">Pesquisar</button>
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