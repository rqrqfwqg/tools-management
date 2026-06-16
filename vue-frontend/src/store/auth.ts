import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as apiLogin, getUserInfo } from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)
  const role = ref<string>('')

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    token.value = res.access_token
    localStorage.setItem('token', res.access_token)
    // res.user 直接包含用户信息
    user.value = res.user
    role.value = res.user.role
  }

  const fetchUserInfo = async () => {
    try {
      const res = await getUserInfo()
      user.value = res
      role.value = res.role
    } catch (e: any) {
      console.error('获取用户信息失败', e)
    }
  }

  const logout = () => {
    token.value = ''
    user.value = null
    role.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('saved_credentials')
  }

  const hasRole = (requiredRoles: string[]) => {
    if (!requiredRoles || requiredRoles.length === 0) return true
    return requiredRoles.includes(role.value)
  }

  return { token, user, role, login, fetchUserInfo, logout, hasRole }
})
