<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'
import { useAutoLogout } from '@/composables/useAutoLogout'
import { requestSubscribeOnLaunch } from '@/composables/useWxSubscribe'

// 全局启动逻辑
onLaunch(() => {
  // 校验本地登录态是否仍有效（token 存在即视为已登录，后续由 request.ts 401 兜底）
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) {
    console.log('[miniapp] App Launch：未登录')
  }
  // 已登录且非游客：请求微信订阅消息授权（保证每日 8/20 未归还提醒能送达）
  if (authStore.isLoggedIn && !authStore.isGuest) {
    requestSubscribeOnLaunch()
  }
})

onShow(() => {
  console.log('[miniapp] App Show')
})

onHide(() => {
  console.log('[miniapp] App Hide')
})

// 自动退出：10 分钟无操作自动退出（onHide/onShow + 时间戳比对，见设计文档 §9.6）
useAutoLogout(10)
</script>

<style lang="scss">
/* 全局基础样式 */
page {
  background-color: $tm-bg;
  color: $tm-text;
  font-size: 28rpx;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

view,
text,
input,
button {
  box-sizing: border-box;
}
</style>
