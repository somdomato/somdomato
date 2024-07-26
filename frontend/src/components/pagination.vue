<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

function goToPage(page: number) {
  if (page >= 1 && page <= props.total) {
    emit('change', page)
  }
}
</script>

<template>
  <nav aria-label="Page navigation">
    <ul class="pagination">
      <li class="page-item" :class="{ disabled: current === 1 }">
        <button class="page-link" @click="goToPage(current - 1)" :disabled="current === 1">Anterior</button>
      </li>
      <li class="page-item" :class="{ active: page === current }" v-for="page in Array.from({ length: total }, (_, i) => i + 1)" :key="page">
        <button class="page-link" @click="goToPage(page)">{{ page }}</button>
      </li>
      <li class="page-item" :class="{ disabled: current === total }">
        <button class="page-link" @click="goToPage(current + 1)" :disabled="current === total">Próximo</button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
}
.page-item.disabled .page-link {
  pointer-events: none;
  opacity: 0.6;
}
.page-item.active .page-link {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
}
</style>