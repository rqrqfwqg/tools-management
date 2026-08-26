/**
 * auth store（小程序适配版）
 * 个人主体小程序无法获取微信手机号，改用「手机号 + 本机记住」登录：
 * - accountLogin(identifier) 调 /auth/login 手机号免密签发 token
 * - 登录成功后由 Login.vue 调用 setLoginPhone 记住本机账号，下次自动登录
 * - 微信 openid 绑定逻辑已废弃（个人主体无法获取本机微信号）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, WxLoginResult } from '@/types'
import { getToken, setToken as persistToken, getStoredUser, setStoredUser, clearAuth } from '@/utils/storage'
import { login as loginApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const user = ref<User | null>(getStoredUser<User>())

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isApprover = computed(() => user.value?.role === 'admin' || user.value?.role === 'team_leader')
  /** 物料管理员：可写物料/安全防护用品（录入/编辑/删除/完成检查） */
  const isMaterialManager = computed(
    () => user.value?.role === 'material_manager' || user.value?.role === 'admin'
  )
  /** 游客模式（只读）：未匹配到系统账号的微信用户 */
  const isGuest = computed(() => user.value?.role === 'guest')

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
   * 手机号免密登录：identifier 为手机号（或用户名），匹配系统账号即签发 token 并持久化到本机。
   * 个人主体小程序无法获取微信手机号，故不再依赖微信 openid 绑定，统一走手机号登录。
   * wxCode 已废弃（个人主体拿不到本机微信号），保留可选参数仅为兼容后端（传空即不绑定）。
   */
  async function accountLogin(identifier: string, wxCode?: string): Promise<WxLoginResult> {
    const result = await loginApi(identifier, wxCode)
    if (result?.access_token) {
      setToken(result.access_token)
    }
    if (result?.user) {
      setUser(result.user)
    }
    return result
  }

  return { token, user, isLoggedIn, isAdmin, isApprover, isMaterialManager, isGuest, setToken, setUser, logout, accountLogin }
})
