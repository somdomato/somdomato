<script setup lang="ts">
import { ref, onMounted } from 'vue'

const online = ref(false)
const url = 'https://radio.somdomato.com' 

function check() {
  fetch(url)
    .then((response) => {
      console.log("response.type =", response.type);
      console.log("response.url =", response.url);
      console.log("response.status =", response.status);
      console.log("response.ok =", response.ok);
      console.log("response.statusText =", response.statusText);
      console.log("response.headers =", response.headers);
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }

      if (response.ok) {
        online.value = true
      } else {
        online.value = false
      }
    })
    .catch((error) => {
      console.log(`Error: ${error.message}`)
      online.value = false
    })
}

onMounted(() => {
  setInterval(check, 10000)
})
</script>
<template>
  <div class="pulse-container">
    <div :class="{ 'pulse': online, 'pulse-red': !online }"></div>
  </div>
</template>
<style lang="scss">
.pulse-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute; 
  width: 30px;
  height: 30px;
  // border: 1px solid red;
  margin-right: 10px;
}

.pulse {
  position: relative;
  display: block;
  height: 7px;
  width: 7px;
  background-color: #1aff00;
  border-radius: 50%;
  animation: pulse-animation 1.3s infinite;
}

@keyframes pulse-animation {
  0% { box-shadow: 0 0 0 0px rgba(37, 249, 0, 0.5); }
  100% { box-shadow: 0 0 0 10px rgba(4, 249, 0, 0); }
}

.pulse-red {
  position: relative;
  display: block;
  height: 7px;
  width: 7px;
  background-color: #c91919;
  border-radius: 50%;
  animation: pulse-red-animation 1.3s infinite;
}

@keyframes pulse-red-animation {
  0% { box-shadow: 0 0 0 0px rgba(249, 0, 0, 0.5); }
  100% { box-shadow: 0 0 0 10px rgba(249, 0, 0, 0); }
}
</style>