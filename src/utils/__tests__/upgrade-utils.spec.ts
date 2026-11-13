import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

import type { DepartmentResponse } from '@/types/system'
import {
  DATA_SCOPE_OPTIONS,
  normalizeRoleDataScope,
  validateRoleDataScope,
} from '@/utils/dataScope'
import {
  buildDepartmentNameMap,
  flattenDepartmentTree,
  formatDepartmentTooltip,
  getDepartmentDescendantIds,
  hasSiblingDepartmentName,
  resolveDepartmentName,
} from '@/utils/departmentTree'
import { stripUnchangedMaskedSecrets } from '@/utils/maskedConfig'
import { hasRoutePermission } from '@/utils/permission'
import { pluginAccountIdentity, pluginAccountPreferenceKey } from '@/utils/pluginAccountIdentity'
import { findRuleJob, stringifyNotificationRuleJobId } from '@/utils/notificationRule'
import type { JobItem } from '@/types/jobs'
import { isUserDeleteConflict } from '@/utils/userDeletion'

function department(
  departmentId: number,
  parentId: number | null,
  departmentName: string,
  children: DepartmentResponse[] = [],
): DepartmentResponse {
  return {
    departmentId,
    parentId,
    departmentName,
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-02T00:00:00',
    updatedAt: '2026-08-02T00:00:00',
    children,
  }
}

const tree = [
  department(1, null, '总部', [
    department(2, 1, '研发部', [department(3, 2, '平台组')]),
    department(4, 1, '产品部'),
  ]),
]

describe('department and data-scope rules', () => {
  it('finds descendants for parent-cycle prevention', () => {
    expect(flattenDepartmentTree(tree).map((item) => item.departmentId)).toEqual([1, 2, 3, 4])
    expect(getDepartmentDescendantIds(tree, 2)).toEqual([3])
  })

  it('detects duplicate names only under the same parent', () => {
    expect(hasSiblingDepartmentName(tree, 1, ' 研发部 ')).toBe(true)
    expect(hasSiblingDepartmentName(tree, 2, '研发部')).toBe(false)
    expect(hasSiblingDepartmentName(tree, 1, '研发部', 2)).toBe(false)
  })

  it('resolves department snapshots before the tree and then falls back to the ID', () => {
    const names = buildDepartmentNameMap(tree)

    expect(names.get(3)).toBe('平台组')
    expect(resolveDepartmentName(2, '执行快照部门', names)).toBe('执行快照部门')
    expect(resolveDepartmentName(2, '', names)).toBe('研发部')
    expect(resolveDepartmentName(99, null, names)).toBe('部门 99')
    expect(resolveDepartmentName(null, null, names)).toBe('-')
    expect(formatDepartmentTooltip(2, null, names)).toBe('研发部（2）')
    expect(formatDepartmentTooltip(99, null, names)).toBe('部门 99')
  })

  it('exposes five scopes, validates CUSTOM, and locks exact ADMIN to ALL', () => {
    expect(DATA_SCOPE_OPTIONS.map((item) => item.value)).toEqual([
      'ALL',
      'CUSTOM',
      'DEPARTMENT',
      'DEPARTMENT_AND_CHILDREN',
      'SELF',
    ])
    expect(validateRoleDataScope('CUSTOM', [])).toBe(false)
    expect(validateRoleDataScope('CUSTOM', [2])).toBe(true)
    expect(normalizeRoleDataScope('ADMIN', 'SELF', [2])).toEqual({
      dataScope: 'ALL',
      departmentIds: [],
    })
    expect(normalizeRoleDataScope('admin', 'CUSTOM', [2])).toEqual({
      dataScope: 'CUSTOM',
      departmentIds: [2],
    })
  })
})

describe('permission and masked configuration helpers', () => {
  it('requires every route permission when permissionMode is all', () => {
    const route: RouteRecordRaw = {
      path: '/plugins/installations/a/notification-channels',
      redirect: '/blocked',
      meta: {
        permissions: [
          'plugin:runtime:manage',
          'plugin:notification-channel:bind',
          'notification:channel:read',
        ],
        permissionMode: 'all',
      },
    }

    expect(
      hasRoutePermission(route, ['plugin:runtime:manage', 'plugin:notification-channel:bind']),
    ).toBe(false)
    expect(
      hasRoutePermission(route, [
        'plugin:runtime:manage',
        'plugin:notification-channel:bind',
        'notification:channel:read',
      ]),
    ).toBe(true)
  })

  it('recursively omits unchanged masked secrets but keeps edited values', () => {
    const original = JSON.stringify({
      token: '******',
      nested: { authorization: '********', keep: 'value' },
    })
    const edited = JSON.stringify({
      token: '',
      nested: { authorization: 'new-secret', keep: 'updated' },
    })

    expect(JSON.parse(stripUnchangedMaskedSecrets(original, edited))).toEqual({
      nested: { authorization: 'new-secret', keep: 'updated' },
    })
  })

  it('uses installation and account IDs together for account cache and local keys', () => {
    expect(pluginAccountIdentity('installation-a', 'account-1')).toBe('installation-a:account-1')
    expect(pluginAccountIdentity('installation-b', 'account-1')).not.toBe(
      pluginAccountIdentity('installation-a', 'account-1'),
    )
    expect(pluginAccountPreferenceKey('account-pref:', 'installation/a', 'account:1')).toBe(
      'account-pref:installation%2Fa:account%3A1',
    )
  })

  it('stringifies rule job IDs and derives the locked installation from the selected job', () => {
    const job = {
      id: 12,
      jobName: '任务',
      pluginInstallationId: 'installation-job',
    } as JobItem

    expect(stringifyNotificationRuleJobId(12)).toBe('12')
    expect(stringifyNotificationRuleJobId('')).toBe('')
    expect(findRuleJob([job], '12')?.pluginInstallationId).toBe('installation-job')
  })

  it('recognizes both backend-code and HTTP user-delete ownership conflicts', () => {
    expect(isUserDeleteConflict({ code: 409001, message: '请先转交资源' })).toBe(true)
    expect(isUserDeleteConflict({ status: 409, message: '请先停用用户' })).toBe(true)
    expect(isUserDeleteConflict({ code: 400001, message: '参数错误' })).toBe(false)
  })
})
