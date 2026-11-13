import type { DataScopeType } from '@/types/system'

export const DATA_SCOPE_OPTIONS: Array<{ label: string; value: DataScopeType }> = [
  { label: '全部数据', value: 'ALL' },
  { label: '自定义部门', value: 'CUSTOM' },
  { label: '本部门', value: 'DEPARTMENT' },
  { label: '本部门及下级部门', value: 'DEPARTMENT_AND_CHILDREN' },
  { label: '仅本人', value: 'SELF' },
]

export function dataScopeLabel(value: DataScopeType) {
  return DATA_SCOPE_OPTIONS.find((item) => item.value === value)?.label || value
}

export function normalizeRoleDataScope(
  roleName: string,
  dataScope: DataScopeType,
  departmentIds: number[],
) {
  const normalizedScope: DataScopeType = roleName === 'ADMIN' ? 'ALL' : dataScope
  return {
    dataScope: normalizedScope,
    departmentIds: normalizedScope === 'CUSTOM' ? [...departmentIds] : [],
  }
}

export function validateRoleDataScope(dataScope: DataScopeType, departmentIds: number[]) {
  return dataScope !== 'CUSTOM' || departmentIds.length > 0
}
