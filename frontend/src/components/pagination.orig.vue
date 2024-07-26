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

function generatePages(current: number, total: number) {
  const pages = []
  const delta = 2
  const left = current - delta
  const right = current + delta
  const range = []
  const rangeWithDots = []
  let l

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i <= right)) {
      range.push(i)
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1)
      } else if (i - l !== 1) {
        rangeWithDots.push('...')
      }
    }
    rangeWithDots.push(i)
    l = i
  }

  return rangeWithDots
}
</script>
<template>
  <nav aria-label="Page navigation">
    <ul class="pagination">
      <li class="page-item" :class="{ disabled: current === 1 }">
        <button class="page-link" @click="goToPage(1)" :disabled="current === 1">Primeiro</button>
      </li>
      <li class="page-item" :class="{ disabled: current === 1 }">
        <button class="page-link" @click="goToPage(current - 1)" :disabled="current === 1">Anterior</button>
      </li>
      <li class="page-item" :class="{ active: page === current }" v-for="page in generatePages(current, total)" :key="page">
        <button class="page-link" @click="goToPage(Number(page))" v-if="page !== '...'">{{ page }}</button>
        <span class="page-link" v-else>...</span>
      </li>
      <li class="page-item" :class="{ disabled: current === total }">
        <button class="page-link" @click="goToPage(current + 1)" :disabled="current === total">Próximo</button>
      </li>
      <li class="page-item" :class="{ disabled: current === total }">
        <button class="page-link" @click="goToPage(total)" :disabled="current === total">Último</button>
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
