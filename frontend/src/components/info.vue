<script setup lang="ts">
import Pulse from '@/components/pulse.vue'
import Icon from '@/components/icon.vue'

defineProps<{
  song?: string
}>()

function share(title: string | undefined, provider = 'wa') {
  let msg
  if (typeof title === 'undefined') msg = encodeURIComponent(`*Rádio Som do Mato* a mais sertaneja!\n\nhttps://somdomato.com`)
  else msg = encodeURIComponent(`Ouça *${title}* na _Rádio Som do Mato_!\n\nhttps://somdomato.com`)
  
  if (provider === 'wa') return `https://wa.me/?text=${msg}`
  if (provider === 'tw') return `https://twitter.com/intent/tweet?text=${msg}`

  else return `https://wa.me/?text=${msg}`
}
</script>
<template>
  <div class="d-flex align-items-center">
    <pulse /> 
    <span v-popover data-bs-trigger="hover focus" :data-bs-content="song" class="d-inline-block text-truncate nav-link text-white fw-light fst-italic ms-2 py-1" style="max-width: 70vw;">
      {{ song }}
    </span>
    <a class="me-1" :href="share(song, 'wa')" target="_blank">
      <icon size="20" name="whatsapp" class="text-white"  />
    </a>
    <a :href="share(song, 'tw')" target="_blank">
      <icon size="20" name="x" class="text-white"  />
    </a>
  </div>
</template>