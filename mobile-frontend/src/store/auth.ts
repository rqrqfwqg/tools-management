import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') }
    catch { return null }
  })()
  const token = ref(localStorage.getItem('token') || '')
  const user = ref<User | null>(savedUser)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isApprover = computed(() => user.value?.role === 'admin' || user.value?.role === 'team_leader')

  function setToken(t: string) {
    token.value = t
    localStorage.setItem('token', t)
  }

  function setUser(u: User) {
    user.value = u
    localStorage.setItem('user', JSON.stringify(u))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('saved_credentials')
  }

  return { token, user, isLoggedIn, isAdmin, isApprover, setToken, setUser, logout }
})
