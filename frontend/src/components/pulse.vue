<template>
  <div class="pulse-container">
    <div class="pulse"></div>
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
  background-color: #FFC700;
  border-radius: 50%;
  // top: 8px;
  // left: -10px;
  animation: pulse-animation 1.3s infinite;
}

@keyframes pulse-animation {
  0% {
    box-shadow: 0 0 0 0px rgba(249, 179, 0, 0.5);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(249, 179, 0, 0);
  }
}
</style>