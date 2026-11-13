import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'

import type { PermissionName } from '@/types/auth'

export function hasPermission(
  userPermissions: PermissionName[],
  required?: PermissionName | PermissionName[],
) {
  if (!required || required.length === 0) return true
  if (Array.isArray(required)) {
    return required.some((permission) => userPermissions.includes(permission))
  }
  return userPermissions.includes(required)
}

export function hasAnyPermission(userPermissions: PermissionName[], permissions: PermissionName[]) {
  return hasPermission(userPermissions, permissions)
}

export function hasAllPermissions(
  userPermissions: PermissionName[],
  permissions: PermissionName[],
) {
  if (permissions.length === 0) return true
  return permissions.every((permission) => userPermissions.includes(permission))
}

export function hasRoutePermission(
  route: RouteRecordRaw | RouteLocationNormalizedLoaded,
  userPermissions: PermissionName[],
) {
  const permission = route.meta?.permission as string | undefined
  const permissions = route.meta?.permissions as string[] | undefined
  const permissionMode = route.meta?.permissionMode as 'any' | 'all' | undefined

  if (permission) return userPermissions.includes(permission)
  if (permissions?.length) {
    return permissionMode === 'all'
      ? permissions.every((item) => userPermissions.includes(item))
      : permissions.some((item) => userPermissions.includes(item))
  }
  return true
}
