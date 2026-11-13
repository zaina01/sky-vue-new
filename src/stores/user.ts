import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getCurrentUser } from '@/api/auth'
import type { CurrentUser, PermissionName } from '@/types/auth'

export const useUserStore = defineStore('user', () => {
  const profile = ref<CurrentUser>()
  const loaded = ref(false)

  const permissions = computed<PermissionName[]>(() => profile.value?.permissions ?? [])
  const displayName = computed(() => profile.value?.username || '管理员')

  function setProfile(user: CurrentUser) {
    profile.value = user
    loaded.value = true
  }

  async function loadProfile() {
    setProfile(await getCurrentUser())
  }

  function clearProfile() {
    profile.value = undefined
    loaded.value = false
  }

  return {
    profile,
    loaded,
    permissions,
    displayName,
    setProfile,
    loadProfile,
    clearProfile,
  }
})
