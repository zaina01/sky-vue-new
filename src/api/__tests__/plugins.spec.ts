import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchDeletePluginAccounts,
  batchUpdatePluginAccountsGroup,
  createPluginAccountGroup,
  deletePluginAccountGroup,
  listPluginAccountGroups,
  renamePluginAccountGroup,
  updatePluginAccountGroup,
  deletePluginServicePermission,
  exportPluginAccounts,
  getPluginAccountViewPreference,
  getPluginConfig,
  getPluginInstallationNotificationChannels,
  getPluginServiceCall,
  getPluginServiceCallRunnerLog,
  getPluginServicePermission,
  installPluginDependencies,
  listLocalPluginDependencyArtifacts,
  listPluginDefinitions,
  listPluginInstallations,
  listPluginServiceCalls,
  listPluginServicePermissions,
  replacePluginInstallationNotificationChannels,
  savePluginServicePermission,
  savePluginServicePermissionsBatch,
  setPluginServicePermissionEnabled,
  updatePluginInstallationDebug,
  updatePluginAccountViewPreference,
  uploadLocalPluginDependencyArtifact,
  uploadPluginArtifact,
} from '@/api/plugins'
import { del, get, patch, post, put } from '@/api/request'
import type { PluginInstallationResponse, PluginRuntimeDebugRequest } from '@/types/plugins'

vi.mock('@/api/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const putMock = vi.mocked(put)
const getMock = vi.mocked(get)
const postMock = vi.mocked(post)
const patchMock = vi.mocked(patch)
const deleteMock = vi.mocked(del)

describe('account group contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses encoded installation segments for group CRUD', async () => {
    const base = '/api/plugins/installations/vendor%2Finstance%201/account-groups'
    await listPluginAccountGroups('vendor/instance 1')
    await createPluginAccountGroup('vendor/instance 1', '主账户')
    await renamePluginAccountGroup('vendor/instance 1', 12, '备用')
    await deletePluginAccountGroup('vendor/instance 1', 12)
    expect(getMock).toHaveBeenCalledWith(base)
    expect(postMock).toHaveBeenCalledWith(base, { name: '主账户' })
    expect(putMock).toHaveBeenCalledWith(`${base}/12`, { name: '备用' })
    expect(deleteMock).toHaveBeenCalledWith(`${base}/12`)
  })

  it('preserves explicit null and encoded account IDs for single and batch moves', async () => {
    await updatePluginAccountGroup('instance/a', 'account/a b', { groupId: null })
    await batchUpdatePluginAccountsGroup('instance/a', { accountIds: ['a', 'b'], groupId: 12 })
    expect(patchMock).toHaveBeenCalledWith(
      '/api/plugins/installations/instance%2Fa/accounts/account%2Fa%20b/group',
      { groupId: null },
    )
    expect(patchMock).toHaveBeenCalledWith(
      '/api/plugins/installations/instance%2Fa/accounts/group',
      { accountIds: ['a', 'b'], groupId: 12 },
    )
  })

  it('passes group and ungrouped export filters without changing the binary response', async () => {
    await exportPluginAccounts('a', { format: 'xlsx', groupId: 12, enabled: false })
    await exportPluginAccounts('a', { format: 'csv', ungrouped: true })
    expect(getMock).toHaveBeenCalledWith('/api/plugins/installations/a/accounts/export', {
      params: { format: 'xlsx', groupId: 12, enabled: false },
      responseType: 'blob',
      timeout: 120000,
    })
    expect(getMock).toHaveBeenCalledWith('/api/plugins/installations/a/accounts/export', {
      params: { format: 'csv', ungrouped: true },
      responseType: 'blob',
      timeout: 120000,
    })
  })
})

const updatedRuntime = {
  id: 1,
  installationId: 'vendor/demo installation:1',
  pluginId: 'vendor/demo plugin:1',
  instanceId: 'runtime-1',
  installationName: '隔离实例',
  version: '1.0.0',
  displayName: '示例插件',
  mainClass: 'com.example.Plugin',
  artifactPath: '/plugins/demo.jar',
  artifactSha256: 'sha256',
  runtimeType: 'JAR',
  state: 'STOPPED',
  runnerHost: null,
  runnerPort: null,
  workDir: null,
  capabilitiesJson: '{}',
  configSchemaJson: '{}',
  accountSchemaJson: '{}',
  remoteDebugEnabled: true,
  remoteDebugPort: 5005,
  remoteDebugSuspend: false,
  managedByCurrentHost: true,
  liveState: 'STOPPED',
  ownerUserId: 'user-1',
  ownerUsername: 'tester',
  ownerDepartmentId: 1,
  ownerDepartmentName: '研发部',
  startedAt: null,
  createdAt: '2026-08-02T00:00:00',
  updatedAt: '2026-08-02T00:00:00',
} satisfies PluginInstallationResponse

describe('updatePluginInstallationDebug', () => {
  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    patchMock.mockReset()
    deleteMock.mockReset()
    putMock.mockResolvedValue(updatedRuntime)
  })

  it('uses PUT with an encoded installationId and the complete request body', async () => {
    const payload: PluginRuntimeDebugRequest = {
      enabled: true,
      port: 5005,
      suspend: false,
    }

    await expect(
      updatePluginInstallationDebug(updatedRuntime.installationId, payload),
    ).resolves.toEqual(updatedRuntime)

    expect(putMock).toHaveBeenCalledTimes(1)
    expect(putMock).toHaveBeenCalledWith(
      '/api/plugins/installations/vendor%2Fdemo%20installation%3A1/debug',
      payload,
    )
  })

  it('keeps definition and installation list contracts separate', async () => {
    getMock.mockResolvedValue({ items: [], page: 2, size: 20, total: 47 })

    await listPluginDefinitions({ page: 2, size: 20, keyword: 'demo' })
    await listPluginInstallations({ page: 3, size: 10, pluginId: 'demo.plugin', state: 'RUNNING' })

    expect(getMock).toHaveBeenNthCalledWith(1, '/api/plugins/definitions', {
      params: { page: 2, size: 20, keyword: 'demo' },
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/plugins/installations', {
      params: { page: 3, size: 10, pluginId: 'demo.plugin', state: 'RUNNING' },
    })
  })

  it('scopes config and account export to installationId and preserves Blob mode', async () => {
    const blob = new Blob(['account'], { type: 'text/csv' })
    getMock.mockResolvedValueOnce({
      installationId: 'installation/a',
      pluginId: 'demo',
      configJson: '{}',
    })
    getMock.mockResolvedValueOnce(blob)

    await getPluginConfig('installation/a')
    await expect(
      exportPluginAccounts('installation/a', { format: 'csv', includeSecret: false }),
    ).resolves.toBe(blob)

    expect(getMock).toHaveBeenNthCalledWith(1, '/api/plugins/installations/installation%2Fa/config')
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/api/plugins/installations/installation%2Fa/accounts/export',
      {
        params: { format: 'csv', includeSecret: false },
        responseType: 'blob',
        timeout: 2 * 60 * 1000,
      },
    )
  })

  it('gets and saves installation-scoped account view preferences', async () => {
    const preference = {
      installationId: 'installation/a',
      fields: ['region', 'username'],
      availableFields: [],
      maxFields: 5,
    }
    getMock.mockResolvedValue(preference)
    putMock.mockResolvedValue(preference)

    await expect(getPluginAccountViewPreference('installation/a')).resolves.toEqual(preference)
    await expect(
      updatePluginAccountViewPreference('installation/a', { fields: ['region', 'username'] }),
    ).resolves.toEqual(preference)

    const url = '/api/plugins/installations/installation%2Fa/accounts/view-preference'
    expect(getMock).toHaveBeenCalledWith(url)
    expect(putMock).toHaveBeenCalledWith(url, { fields: ['region', 'username'] })
  })

  it('sends batch account deletion as one DELETE request with a JSON body', async () => {
    const response = {
      installationId: 'installation/a',
      total: 2,
      succeeded: 1,
      failed: 1,
      receipts: [
        { accountId: 'account-a', success: true, message: 'Deleted' },
        { accountId: 'account-b', success: false, message: 'Plugin account not found' },
      ],
    }
    const payload = { accountIds: ['account-a', 'account-b'] }
    deleteMock.mockResolvedValue(response)

    await expect(batchDeletePluginAccounts('installation/a', payload)).resolves.toEqual(response)

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteMock).toHaveBeenCalledWith(
      '/api/plugins/installations/installation%2Fa/accounts',
      { data: payload },
    )
    expect(deleteMock.mock.calls[0]?.[1]).not.toHaveProperty('params')
  })

  it('uploads only to the global artifact endpoint', async () => {
    postMock.mockResolvedValue({ pluginId: 'demo.plugin' })

    await uploadPluginArtifact(new File(['jar'], 'demo.jar'))

    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0]?.[0]).toBe('/api/plugins/artifacts')
    expect(postMock.mock.calls[0]?.[0]).not.toContain('/installations')
    expect(postMock.mock.calls[0]?.[1]).toBeInstanceOf(FormData)
  })

  it('uses backend pagination when listing local dependency artifacts', async () => {
    getMock.mockResolvedValue({ items: [], page: 3, size: 20, total: 58 })

    await listLocalPluginDependencyArtifacts({ page: 3, size: 20, keyword: 'local-sdk' })

    expect(getMock).toHaveBeenCalledWith('/api/plugins/dependencies/local-artifacts', {
      params: { page: 3, size: 20, keyword: 'local-sdk' },
    })
  })

  it('uploads local dependency coordinates as multipart fields', async () => {
    const file = new File(['jar'], 'local-sdk.jar', { type: 'application/java-archive' })
    postMock.mockResolvedValue({ coordinate: 'com.example:local-sdk:1.2.3' })

    await uploadLocalPluginDependencyArtifact({
      file,
      groupId: 'com.example',
      artifactId: 'local-sdk',
      version: '1.2.3',
    })

    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock.mock.calls[0]?.[0]).toBe('/api/plugins/dependencies/local-artifacts')
    const body = postMock.mock.calls[0]?.[1] as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('file')).toBe(file)
    expect(body.get('groupId')).toBe('com.example')
    expect(body.get('artifactId')).toBe('local-sdk')
    expect(body.get('version')).toBe('1.2.3')
    expect(postMock.mock.calls[0]?.[2]).toEqual({ timeout: 10 * 60 * 1000 })
  })

  it('installs selected dependencies through the definition-level endpoint', async () => {
    postMock.mockResolvedValue({ pluginId: 'vendor/demo plugin:1', dependencies: [] })
    const payload = {
      dependencies: ['com.example:local-sdk:1.2.3'],
      mode: 'merge' as const,
    }

    await installPluginDependencies('vendor/demo plugin:1', payload)

    expect(postMock).toHaveBeenCalledWith(
      '/api/plugins/definitions/vendor%2Fdemo%20plugin%3A1/dependencies/install',
      payload,
    )
  })

  it('uses installation IDs for notification pools and service permission writes', async () => {
    putMock.mockResolvedValue([])
    postMock.mockResolvedValue({})
    getMock
      .mockResolvedValueOnce(['channel-1'])
      .mockResolvedValueOnce({ items: [], page: 1, size: 10, total: 123 })

    await getPluginInstallationNotificationChannels('installation/1')
    await replacePluginInstallationNotificationChannels('installation-1', ['channel-1'])
    await savePluginServicePermission({
      callerInstallationId: 'caller-installation',
      targetInstallationId: 'target-installation',
      operation: 'resolveAccount',
      enabled: true,
    })
    await listPluginServicePermissions({
      page: 4,
      size: 20,
      callerInstallationId: 'caller-installation',
      callerPluginId: 'caller.definition',
    })

    expect(putMock).toHaveBeenCalledWith(
      '/api/plugins/installations/installation-1/notification-channels',
      { channelIds: ['channel-1'] },
    )
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      '/api/plugins/installations/installation%2F1/notification-channels',
    )
    expect(postMock).toHaveBeenCalledWith('/api/plugin-service/permissions', {
      callerInstallationId: 'caller-installation',
      targetInstallationId: 'target-installation',
      operation: 'resolveAccount',
      enabled: true,
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/plugin-service/permissions', {
      params: {
        page: 4,
        size: 20,
        callerInstallationId: 'caller-installation',
        callerPluginId: 'caller.definition',
      },
    })
  })

  it('uses the real permission detail, state and delete response contracts', async () => {
    const permission = {
      id: 41,
      callerInstallationId: 'task-installation',
      callerPluginId: 'frontend-integration',
      targetInstallationId: 'service-installation',
      targetPluginId: 'frontend-integration-service',
      operation: 'echo',
      enabled: true,
      createdAt: '2026-08-02T00:00:00',
      updatedAt: '2026-08-02T00:00:00',
    }
    getMock.mockResolvedValue(permission)
    patchMock.mockResolvedValue({ ...permission, enabled: false })
    deleteMock.mockResolvedValue({ success: true })

    await getPluginServicePermission(41)
    await setPluginServicePermissionEnabled(41, false)
    await deletePluginServicePermission(41)

    expect(getMock).toHaveBeenCalledWith('/api/plugin-service/permissions/41')
    expect(patchMock).toHaveBeenCalledWith('/api/plugin-service/permissions/41/enabled', {
      enabled: false,
    })
    expect(deleteMock).toHaveBeenCalledWith('/api/plugin-service/permissions/41')
  })

  it('preserves service-call pagination and runner-log query metadata', async () => {
    getMock
      .mockResolvedValueOnce({ items: [], page: 3, size: 20, total: 47 })
      .mockResolvedValueOnce({ id: 9, success: true })
      .mockResolvedValueOnce({
        serviceCallLogId: 9,
        exists: true,
        content: 'frontend integration service',
        offset: 10,
        nextOffset: 30,
        limitBytes: 20,
        sizeBytes: 30,
        eof: true,
        truncated: false,
      })

    await listPluginServiceCalls({
      jobId: '1',
      callerInstallationId: 'task-installation',
      targetInstallationId: 'service-installation',
      operation: 'echo',
      page: 3,
      size: 20,
    })
    await getPluginServiceCall(9)
    await getPluginServiceCallRunnerLog(9, { tailBytes: 65_536 })

    expect(getMock).toHaveBeenNthCalledWith(1, '/api/plugin-service/calls', {
      params: {
        jobId: '1',
        callerInstallationId: 'task-installation',
        targetInstallationId: 'service-installation',
        operation: 'echo',
        page: 3,
        size: 20,
      },
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/plugin-service/calls/9')
    expect(getMock).toHaveBeenNthCalledWith(3, '/api/plugin-service/calls/9/logs', {
      params: { tailBytes: 65_536 },
    })
  })
})

describe('batch service permissions', () => {
  it('posts multiple operations once and returns the saved permissions', async () => {
    postMock.mockClear()
    const data = {
      callerInstallationId: 'caller',
      targetInstallationId: 'target',
      operations: ['first', 'second', 'third'],
      enabled: false,
    }
    const saved = data.operations.map((operation, id) => ({ id, operation, enabled: false }))
    postMock.mockResolvedValueOnce(saved)
    expect(await savePluginServicePermissionsBatch(data)).toEqual(saved)
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/plugin-service/permissions/batch', data)
  })
})
