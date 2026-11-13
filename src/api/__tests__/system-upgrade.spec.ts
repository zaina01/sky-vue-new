import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDepartment,
  listDepartments,
  listUsers,
  setDepartmentEnabled,
  transferDataOwnership,
  updateRoleDataScope,
} from '@/api/system'
import { get, patch, post, put } from '@/api/request'

vi.mock('@/api/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const getMock = vi.mocked(get)
const patchMock = vi.mocked(patch)
const postMock = vi.mocked(post)
const putMock = vi.mocked(put)

describe('system ownership and department APIs', () => {
  beforeEach(() => {
    getMock.mockResolvedValue([])
    patchMock.mockResolvedValue({})
    postMock.mockResolvedValue({})
    putMock.mockResolvedValue({})
  })

  it('passes department filters and the complete upsert body', async () => {
    await listDepartments({ departmentName: '研发', enabled: false })
    await createDepartment({
      parentId: 3,
      departmentName: '平台组',
      sortOrder: 10,
      enabled: true,
    })
    await setDepartmentEnabled(3, false)

    expect(getMock).toHaveBeenCalledWith('/api/system/departments', {
      params: { departmentName: '研发', enabled: false },
    })
    expect(postMock).toHaveBeenCalledWith('/api/system/departments', {
      parentId: 3,
      departmentName: '平台组',
      sortOrder: 10,
      enabled: true,
    })
    expect(patchMock).toHaveBeenCalledWith('/api/system/departments/3/enabled', {
      enabled: false,
    })
  })

  it('uses departmentId as a backend user-list filter', async () => {
    await listUsers({ page: 2, size: 30, username: 'alice', enabled: true, departmentId: 7 })

    expect(getMock).toHaveBeenCalledWith('/api/system/users', {
      params: { page: 2, size: 30, username: 'alice', enabled: true, departmentId: 7 },
    })
  })

  it('writes role data scope through the independent endpoint', async () => {
    await updateRoleDataScope(9, { dataScope: 'CUSTOM', departmentIds: [2, 4] })

    expect(putMock).toHaveBeenCalledWith('/api/system/roles/9/data-scope', {
      dataScope: 'CUSTOM',
      departmentIds: [2, 4],
    })
  })

  it('submits all ownership resources and lets the backend adopt the target department', async () => {
    const payload = {
      targetUserId: 'target-user',
      pluginInstallationIds: ['installation-a'],
      jobIds: [12],
      notificationChannelIds: ['channel-a'],
      notificationRuleIds: ['rule-a'],
    }

    await transferDataOwnership(payload)

    expect(postMock).toHaveBeenCalledWith('/api/system/data-ownership/transfer', payload)
  })
})
