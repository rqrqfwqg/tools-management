<template>
  <div id="app-container">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useAutoLogout } from '@/composables/useAutoLogout'
useAutoLogout(10)
</script>
