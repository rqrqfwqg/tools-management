/**
 * useAutoLogout — 小程序自动退出（适配版）
 *
 * 自 mobile-frontend/src/composables/useAutoLogout.ts 拷贝并适配（设计文档 §9.6）：
 * - vue-router → uni.reLaunch('/pages/login/Login')
 * - document DOM 事件不可用 → 小程序 onHide/onShow 生命周期 + 时间戳比对
 * - vant showNotify/showToast → utils/feedback.ts
 *
 * 策略：onHide 记录离开时间戳并清除定时器；onShow 回来时比对时间差，
 * 超过 TIMEOUT 直接退出，否则重新启动倒计时。
 */
import { ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'
import { showToast } from '@/utils/feedback'

export function useAutoLogout(minutes = 10) {
  const authStore = useAuthStore()
  const warned = ref(false)
  const TIMEOUT = minutes * 60 * 1000
  const WARNING = 60 * 1000

  /** 最近一次活跃时间戳（ms），onHide 时记录、onShow 时比对 */
  let lastActiveAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | null = null
  let warningTimer: ReturnType<typeof setTimeout> | null = null

  function clearTimers() {
    if (timer) clearTimeout(timer)
    if (warningTimer) clearTimeout(warningTimer)
    timer = null
    warningTimer = null
  }

  function forceLogout() {
    authStore.logout()
    showToast('已自动退出登录', 'none')
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/Login' })
    }, 500)
  }

  function startTimers() {
    clearTimers()
    warned.value = false
    warningTimer = setTimeout(() => {
      warned.value = true
      showToast(`${minutes}分钟无操作，即将自动退出`, 'none')
    }, Math.max(TIMEOUT - WARNING, 0))
    timer = setTimeout(() => {
      forceLogout()
    }, TIMEOUT)
  }

  function resetTimer() {
    if (!authStore.isLoggedIn) return
    lastActiveAt = Date.now()
    startTimers()
  }

  function onPageShow() {
    if (!authStore.isLoggedIn) return
    // 重新可见：用时间戳比对判断离开期间是否超时
    const elapsed = Date.now() - lastActiveAt
    if (elapsed >= TIMEOUT) {
      forceLogout()
      return
    }
    resetTimer()
  }

  function onPageHide() {
    if (!authStore.isLoggedIn) return
    // 记录离开时间戳，暂停倒计时
    lastActiveAt = Date.now()
    clearTimers()
  }

  onShow(onPageShow)
  onHide(onPageHide)

  return { warned, resetTimer }
}
