import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'

/** 10分钟无操作自动退出登录 */
export function useAutoLogout(timeoutMinutes = 10) {
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null
  let warningTimer: ReturnType<typeof setTimeout> | null = null
  const WARNING_BEFORE = 60_000 // 提前60秒警告
  const TIMEOUT_MS = timeoutMinutes * 60 * 1000

  const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart', 'visibilitychange'] as const

  const doLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    ElNotification({
      title: '已自动退出',
      message: '由于10分钟无操作，系统已自动退出登录',
      type: 'warning',
      duration: 5000,
    })
    router.push('/login')
  }

  const resetTimer = () => {
    // 页面不可见时不重置计时器
    if (document.visibilityState === 'hidden') return

    if (timer) clearTimeout(timer)
    if (warningTimer) clearTimeout(warningTimer)

    // 提前60秒显示警告
    if (TIMEOUT_MS > WARNING_BEFORE) {
      warningTimer = setTimeout(() => {
        ElMessage.warning({
          message: '您已10分钟无操作，60秒后系统将自动退出登录',
          duration: 0,
          showClose: true,
        })
      }, TIMEOUT_MS - WARNING_BEFORE)
    }

    timer = setTimeout(doLogout, TIMEOUT_MS)
  }

  onMounted(() => {
    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })
    resetTimer()
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
    if (warningTimer) clearTimeout(warningTimer)
    events.forEach((event) => {
      window.removeEventListener(event, resetTimer)
    })
  })
}
