import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSongStore = defineStore('song', () => {
  const title = ref('Rádio Som do Mato')
  const genre = ref('Sertanejo')
  
  function setTitle(newTitle: string) {
    title.value = newTitle
  }
  
  function setGenre(newGenre: string) {
    genre.value = newGenre
  }

  return { title, genre, setTitle, setGenre }
})
