<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const messages = ref<string[]>([]);
const inputMessage = ref<string>("");
let worker: Worker | null = null;

onMounted(() => {
  worker = new Worker(new URL('../workers/websocketWorker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (event) => {
    messages.value.push(event.data);
  };
});

onUnmounted(() => {
  if (worker) {
    worker.postMessage("close");
    worker.terminate();
  }
});

const sendMessage = () => {
  if (worker && inputMessage.value) {
    worker.postMessage(inputMessage.value);
    inputMessage.value = "";
  }
};
</script>

<template>
  <div>
    <h1>WebSocket com Web Workers</h1>
    <div>
      <input v-model="inputMessage" placeholder="Digite uma mensagem" />
      <button @click="sendMessage">Enviar</button>
    </div>
    <div>
      <h2>Mensagens:</h2>
      <ul>
        <li v-for="(message, index) in messages" :key="index">{{ message }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Adicione seu estilo aqui */
</style>
