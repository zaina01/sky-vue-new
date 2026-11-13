import { defineStore } from 'pinia'
import { computed } from 'vue'

import { adminRoutes, type AdminRouteRecord } from '@/router/routes'
import { useUserStore } from '@/stores/user'
import { hasPermission, hasRoutePermission } from '@/utils/permission'

function filterMenuRoutes(routes: AdminRouteRecord[], permissions: string[]): AdminRouteRecord[] {
  const filteredRoutes: AdminRouteRecord[] = []

  routes.forEach((route) => {
    const children = route.children ? filterMenuRoutes(route.children, permissions) : []
    const selfAllowed = !route.meta?.hidden && hasRoutePermission(route, permissions)
    const childAllowed = children.length > 0

    if (!selfAllowed && !childAllowed) return

    filteredRoutes.push({
      ...route,
      children,
    } as AdminRouteRecord)
  })

  return filteredRoutes
}

export const usePermissionStore = defineStore('permission', () => {
  const userStore = useUserStore()

  const menus = computed(() => filterMenuRoutes(adminRoutes, userStore.permissions))

  function can(permission?: string | string[]) {
    return hasPermission(userStore.permissions, permission)
  }

  return {
    menus,
    can,
  }
})
