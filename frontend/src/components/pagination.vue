<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
}>()

const emit = defineEmits<(e: 'change', page: number) => void>()

function goToPage(page: number) {
  if (page >= 1 && page <= props.total) {
    emit('change', page)
  }
}

function generatePages(current: number, total: number): (number | string)[] {
  const delta = 2
  const range: number[] = []
  const pages: (number | string)[] = []
  let left = current - delta
  let right = current + delta

  // Ensure the range does not go out of bounds
  if (left < 2) {
    left = 2
    right = left + delta * 2
  }
  if (right > total - 1) {
    right = total - 1
    left = right - delta * 2
    if (left < 2) left = 2
  }

  range.push(1)
  for (let i = left; i <= right; i++) {
    range.push(i)
  }
  range.push(total)

  for (const i of range) {
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1] as number
      if (i - lastPage === 2) {
        pages.push(lastPage + 1)
      } else if (i - lastPage !== 1) {
        pages.push('...')
      }
    }
    pages.push(i)
  }

  return pages
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
