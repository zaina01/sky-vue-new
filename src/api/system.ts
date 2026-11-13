import { del, get, patch, post, put } from './request'
import type { ID, PageResponse } from '@/types/common'
import type {
  DataOwnershipTransferRequest,
  DataOwnershipTransferResponse,
  DepartmentQuery,
  DepartmentResponse,
  LoginLogItem,
  LoginLogQuery,
  PermissionItem,
  PermissionQuery,
  ResetUserPasswordPayload,
  RetentionCleanupRequest,
  RetentionCleanupResponse,
  RoleItem,
  RolePayload,
  RolePermissionsPayload,
  ReplaceRoleDataScopeRequest,
  RoleQuery,
  SuccessResult,
  SystemLogItem,
  SystemOverviewQuery,
  SystemOverviewResponse,
  SystemLogQuery,
  SystemSettingItem,
  SystemSettingQuery,
  SystemSettingUpdatePayload,
  SystemSettingsBatchUpdatePayload,
  UserCreatePayload,
  UserItem,
  UserQuery,
  UserRolesPayload,
  UserUpdatePayload,
  UpsertDepartmentRequest,
} from '@/types/system'

export function getSystemOverview(params?: SystemOverviewQuery) {
  return get<SystemOverviewResponse>('/api/system/overview', { params })
}

export function listUsers(params: UserQuery) {
  return get<PageResponse<UserItem>>('/api/system/users', { params })
}

export function getUser(id: ID) {
  return get<UserItem>(`/api/system/users/${id}`)
}

export function createUser(data: UserCreatePayload) {
  return post<UserItem, UserCreatePayload>('/api/system/users', data)
}

export function updateUser(id: ID, data: UserUpdatePayload) {
  return put<UserItem, UserUpdatePayload>(`/api/system/users/${id}`, data)
}

export function updateUserRoles(id: ID, roles: string[]) {
  const data: UserRolesPayload = { roles }
  return put<UserItem, UserRolesPayload>(`/api/system/users/${id}/roles`, data)
}

export function setUserEnabled(id: ID, enabled: boolean) {
  return patch<UserItem, { enabled: boolean }>(`/api/system/users/${id}/enabled`, { enabled })
}

export function deleteUser(id: ID) {
  return del<SuccessResult>(`/api/system/users/${id}`)
}

export function resetUserPassword(id: ID, password: string) {
  return post<SuccessResult, ResetUserPasswordPayload>(`/api/system/users/${id}/password/reset`, {
    password,
  })
}

export function listRoles(params: RoleQuery) {
  return get<PageResponse<RoleItem>>('/api/system/roles', { params })
}

export function createRole(data: RolePayload) {
  return post<RoleItem, RolePayload>('/api/system/roles', data)
}

export function updateRole(id: ID, data: RolePayload) {
  return put<RoleItem, RolePayload>(`/api/system/roles/${id}`, data)
}

export function updateRolePermissions(id: ID, permissions: string[]) {
  const data: RolePermissionsPayload = { permissions }
  return put<RoleItem, RolePermissionsPayload>(`/api/system/roles/${id}/permissions`, data)
}

export function updateRoleDataScope(id: ID, data: ReplaceRoleDataScopeRequest) {
  return put<RoleItem, ReplaceRoleDataScopeRequest>(`/api/system/roles/${id}/data-scope`, data)
}

export function listDepartments(params: DepartmentQuery = {}) {
  return get<DepartmentResponse[]>('/api/system/departments', { params })
}

export function getDepartment(id: number) {
  return get<DepartmentResponse>(`/api/system/departments/${id}`)
}

export function createDepartment(data: UpsertDepartmentRequest) {
  return post<DepartmentResponse, UpsertDepartmentRequest>('/api/system/departments', data)
}

export function updateDepartment(id: number, data: UpsertDepartmentRequest) {
  return put<DepartmentResponse, UpsertDepartmentRequest>(`/api/system/departments/${id}`, data)
}

export function setDepartmentEnabled(id: number, enabled: boolean) {
  return patch<DepartmentResponse, { enabled: boolean }>(`/api/system/departments/${id}/enabled`, {
    enabled,
  })
}

export function deleteDepartment(id: number) {
  return del<SuccessResult>(`/api/system/departments/${id}`)
}

export function transferDataOwnership(data: DataOwnershipTransferRequest) {
  return post<DataOwnershipTransferResponse, DataOwnershipTransferRequest>(
    '/api/system/data-ownership/transfer',
    data,
  )
}

export function deleteRole(id: ID) {
  return del<SuccessResult>(`/api/system/roles/${id}`)
}

export function listPermissions(params: PermissionQuery) {
  return get<PageResponse<PermissionItem>>('/api/system/permissions', { params })
}

export function listSystemSettings(params?: SystemSettingQuery) {
  return get<SystemSettingItem[]>('/api/system/settings', { params })
}

export function getSystemSetting(key: string) {
  return get<SystemSettingItem>(`/api/system/settings/${encodeURIComponent(key)}`)
}

export function updateSystemSetting(key: string, value: unknown) {
  return put<SystemSettingItem, SystemSettingUpdatePayload>(
    `/api/system/settings/${encodeURIComponent(key)}`,
    { value },
  )
}

export function updateSystemSettings(values: Record<string, unknown>) {
  return put<SystemSettingItem[], SystemSettingsBatchUpdatePayload>('/api/system/settings', {
    values,
  })
}

export async function listAllPermissions(permissionName = '') {
  const size = 100
  const first = await listPermissions({ page: 1, size, permissionName })
  const items = [...first.items]
  const totalPages = Math.ceil(first.total / size)
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listPermissions({ page, size, permissionName })
    items.push(...response.items)
  }
  return items
}

export function listSystemLogs(params: SystemLogQuery) {
  return get<PageResponse<SystemLogItem>>('/api/system/logs', { params })
}

export function listLoginLogs(params: LoginLogQuery) {
  return get<PageResponse<LoginLogItem>>('/api/system/login-logs', { params })
}

export function runRetentionCleanup(data: RetentionCleanupRequest) {
  return post<RetentionCleanupResponse, RetentionCleanupRequest>(
    '/api/system/retention-cleanup',
    data,
  )
}
