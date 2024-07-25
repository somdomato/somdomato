import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { History } from '@/types'

export const useSongStore = defineStore('song', () => {
  const title = ref('Rádio Som do Mato')
  const genre = ref('Sertanejo')
  const request = ref('')
  const history = ref<History[]>([])
  
  function setRequest(newRequest: string) {
    request.value = newRequest
  }

  function setTitle(newTitle: string) {
    title.value = newTitle
  }
  
  function setGenre(newGenre: string) {
    genre.value = newGenre
  }

  function updateHistory(hist: History[]) {
    // if (history.value.length > 10) history.value.shift()
    // if (history.value.length > 10) history.value.shift()
    history.value = hist
  }

  return { title, genre, request, history, setTitle, setGenre, setRequest }
})
