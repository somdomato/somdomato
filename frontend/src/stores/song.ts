import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { History } from '@/types'

export const useSongStore = defineStore('song', () => {
  const title = ref('Rádio Som do Mato')
  const history = ref<History[]>([])

  function setTitle(song: string) {
    title.value = song
  }

  function updateHistory(hist: History[]) {
    history.value = hist
  }

  return { title, history, setTitle, updateHistory }
})
