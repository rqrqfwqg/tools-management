import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { showToast, showNotify } from 'vant'

export function useAutoLogout(minutes = 10) {
  const router = useRouter()
  const authStore = useAuthStore()
  let timer: any = null
  let warningTimer: any = null
  const warned = ref(false)
  const TIMEOUT = minutes * 60 * 1000
  const WARNING = 60 * 1000

  function resetTimer() {
    if (!authStore.isLoggedIn) return
    clearTimeout(timer)
    clearTimeout(warningTimer)
    warned.value = false

    warningTimer = setTimeout(() => {
      warned.value = true
      showNotify({
        type: 'warning',
        message: `${minutes}分钟无操作，即将自动退出`,
        duration: 3000
      })
    }, TIMEOUT - WARNING)

    timer = setTimeout(() => {
      authStore.logout()
      router.push('/login')
      showToast('已自动退出登录')
    }, TIMEOUT)
  }

  function onActivity() {
    resetTimer()
  }

  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']

  onMounted(() => {
    if (!authStore.isLoggedIn) return
    resetTimer()
    events.forEach(e => document.addEventListener(e, onActivity))
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    clearTimeout(timer)
    clearTimeout(warningTimer)
    events.forEach(e => document.removeEventListener(e, onActivity))
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') resetTimer()
  }

  return { warned }
}
