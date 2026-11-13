import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { login as loginApi } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import type { LoginRequest } from '@/types/auth'
import { clearToken, getToken, setToken } from '@/utils/token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken() || '')

  const isAuthenticated = computed(() => Boolean(token.value))

  async function login(data: LoginRequest) {
    const response = await loginApi(data)
    token.value = response.token
    setToken(response.token)
    useUserStore().setProfile(response.user)
  }

  function logout() {
    token.value = ''
    clearToken()
    useUserStore().clearProfile()
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
  }
})
