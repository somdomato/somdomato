<script setup lang="ts">
import BaseLayout from '@/layouts/base.vue'
import { Notivue, Notification } from 'notivue'
</script>
<template>
  <base-layout>
    <router-view v-slot="{ Component, route }">
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
    
    <Notivue v-slot="item">
      <Notification :item="item" />
    </Notivue>
  </base-layout>
</template>
<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Notivue */
:root {
  /* Your variables */
  --header-height: 90px;
  --container-padding: 30px;
  --container-width: 1280px;

  /* Set the maximum width of the stream */
  --nv-root-width: var(--container-width);

  /* Add the top padding and place it below the header */
  --nv-root-top: calc(var(--header-height) + var(--container-padding));

  /* Add the same left-right paddings of your app container */
  --nv-root-left: var(--container-padding);
  --nv-root-right: var(--container-padding);
}

/* Rules for mobile devices */
@media (max-width: 768px) {
  :root {
    --nv-root-x-align: center;
    --header-height: 60px;
    --container-padding: 20px;
  }
}
</style>