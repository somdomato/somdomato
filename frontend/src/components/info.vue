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
    <div class="d-flex align-items-center ms-4 me-3">
      <!-- <span v-popover data-bs-trigger="hover focus" :data-bs-content="song" class="title d-inline-block text-truncate nav-link text-white ms-2 py-1" style="max-width: 70vw;">
        {{ song }}
      </span> -->
      <span class="title d-inline-block text-truncate nav-link text-white ms-2 py-1" style="max-width: 58vw;">
        {{ song }}
      </span>
    </div>
    <div class="d-flex align-items-center gap-1">
      <a class="me-1" :href="share(song, 'wa')" target="_blank">
        <icon size="20" name="whatsapp" class="text-white"  />
      </a>
      <a :href="share(song, 'tw')" target="_blank">
        <icon size="20" name="x" class="text-white"  />
      </a>
    </div>
  </div>
</template>
<style scoped lang="scss">
.title {
  font-size: 1.2rem;
  font-weight: 300;
  color: white;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  padding: .2em .4em;
  margin-left: 50px;
  /* deslocamento-x | deslocamento-y | raio-de-desfoque | cor */
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.7);
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.8); 
}
</style>