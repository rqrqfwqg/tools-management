/**
 * auth store（小程序适配版）
 * 自 mobile-frontend/src/store/auth.ts 拷贝并适配：
 * - localStorage 直接调用 → utils/storage.ts（getToken/setToken/getStoredUser/setStoredUser/clearAuth）
 * - 新增 wxLogin 动作（调用 api.wxLogin）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, WxLoginResult } from '@/types'
import { getToken, setToken as persistToken, getStoredUser, setStoredUser, clearAuth } from '@/utils/storage'
import { wxLogin as wxLoginApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const user = ref<User | null>(getStoredUser<User>())

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isApprover = computed(() => user.value?.role === 'admin' || user.value?.role === 'team_leader')

  function setToken(t: string) {
    token.value = t
    persistToken(t)
  }

  function setUser(u: User) {
    user.value = u
    setStoredUser(u)
  }

  function logout() {
    token.value = ''
    user.value = null
    clearAuth()
  }

  /**
   * 微信一键登录：code 由 uni.login 获取
   * 成功后写入 token + user 并返回完整结果
   */
  async function wxLogin(code: string, nickname?: string, avatar?: string): Promise<WxLoginResult> {
    const result = await wxLoginApi(code, nickname, avatar)
    if (result?.access_token) {
      setToken(result.access_token)
    }
    if (result?.user) {
      setUser(result.user)
    }
    return result
  }

  return { token, user, isLoggedIn, isAdmin, isApprover, setToken, setUser, logout, wxLogin }
})
