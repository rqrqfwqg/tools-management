<template>
  <van-config-provider :theme-vars="themeVars">
    <div id="app-container">
      <router-view />
    </div>
  </van-config-provider>
</template>

<script setup lang="ts">
import { useAutoLogout } from '@/composables/useAutoLogout'
useAutoLogout(10)

/** Vant 主题变量：Toast 白底黑字 */
const themeVars = {
  toastBackground: '#ffffff',
  toastTextColor: '#323233',
  toastIconColor: '#323233',
  toastLoadingIconColor: '#1989fa',
}
</script>
