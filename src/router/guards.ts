import type { Router } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { hasRoutePermission } from '@/utils/permission'

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore()
    const userStore = useUserStore()
    const isPublic = Boolean(to.meta.public)

    if (isPublic) {
      if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/init-admin')) {
        return '/dashboard'
      }
      return true
    }

    if (!authStore.isAuthenticated) {
      return {
        path: '/login',
        query: { redirect: to.fullPath },
      }
    }

    if (!userStore.loaded) {
      await userStore.loadProfile()
    }

    if (!hasRoutePermission(to, userStore.permissions)) {
      return '/403'
    }

    return true
  })
}
