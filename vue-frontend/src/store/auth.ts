import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo } from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)
  const role = ref<string>('')

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

  return { token, user, role, fetchUserInfo, logout, hasRole }
})
