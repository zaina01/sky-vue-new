import { del, get, patch, post, put } from './request'
import type { ID, PageResponse } from '@/types/common'
import type {
  BatchDeletePluginAccountRequest,
  BatchDeletePluginAccountResponse,
  BatchUpdatePluginAccountGroupRequest,
  BatchUpdatePluginAccountGroupResponse,
  PluginAccountGroup,
  UpdatePluginAccountGroupRequest,
  BatchUpdatePluginAccountStateRequest,
  BatchUpdatePluginAccountStateResponse,
  CreatePluginInstallationRequest,
  LocalPluginDependencyArtifact,
  LocalPluginDependencyArtifactQuery,
  LocalPluginDependencyUploadPayload,
  LocalPluginDependencyUploadResponse,
  PluginAccountExportQuery,
  PluginAccountImportQuery,
  PluginAccountImportResult,
  PluginAccountDetail,
  PluginAccountListItem,
  PluginAccountPayload,
  PluginAccountQuery,
  PluginAccountSchemaResponse,
  PluginAccountViewPreference,
  PluginAuditLogItem,
  PluginAuditLogQuery,
  PluginConfigResponse,
  PluginDefinitionQuery,
  PluginDefinitionResponse,
  PluginDependency,
  PluginDependencyInstallRequest,
  PluginDependencyInstallResponse,
  PluginDependencyUninstallRequest,
  PluginInstallationQuery,
  PluginInstallationResponse,
  PluginOptionItem,
  PluginOptionQuery,
  PluginRuntimeDebugRequest,
  PluginServiceCallLog,
  PluginServiceCallQuery,
  PluginServiceCallRunnerLog,
  PluginServiceCallRunnerLogQuery,
  PluginServicePermissionItem,
  PluginServicePermissionQuery,
  PluginUploadResult,
  UpdatePluginAccountViewPreferenceRequest,
  UpsertPluginServicePermissionRequest,
  BatchUpsertPluginServicePermissionRequest,
} from '@/types/plugins'

function segment(value: string | number) {
  return encodeURIComponent(String(value))
}

export function uploadPluginArtifact(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return post<PluginUploadResult, FormData>('/api/plugins/artifacts', formData, {
    timeout: 10 * 60 * 1000,
  })
}

export function listPluginDefinitions(params: PluginDefinitionQuery) {
  return get<PageResponse<PluginDefinitionResponse>>('/api/plugins/definitions', { params })
}

export function getPluginDefinition(pluginId: string) {
  return get<PluginDefinitionResponse>(`/api/plugins/definitions/${segment(pluginId)}`)
}

export function deletePluginDefinition(pluginId: string) {
  return del<void>(`/api/plugins/definitions/${segment(pluginId)}`)
}

export function listPluginInstallations(params: PluginInstallationQuery) {
  return get<PageResponse<PluginInstallationResponse>>('/api/plugins/installations', { params })
}

export function createPluginInstallation(data: CreatePluginInstallationRequest) {
  return post<PluginInstallationResponse, CreatePluginInstallationRequest>(
    '/api/plugins/installations',
    data,
  )
}

export function getPluginInstallation(installationId: string) {
  return get<PluginInstallationResponse>(`/api/plugins/installations/${segment(installationId)}`)
}

export function startPluginInstallation(installationId: string) {
  return post<PluginInstallationResponse>(
    `/api/plugins/installations/${segment(installationId)}/start`,
  )
}

export function stopPluginInstallation(installationId: string) {
  return post<PluginInstallationResponse>(
    `/api/plugins/installations/${segment(installationId)}/stop`,
  )
}

export function restartPluginInstallation(installationId: string) {
  return post<PluginInstallationResponse>(
    `/api/plugins/installations/${segment(installationId)}/restart`,
  )
}

export function updatePluginInstallationDebug(
  installationId: string,
  data: PluginRuntimeDebugRequest,
) {
  return put<PluginInstallationResponse, PluginRuntimeDebugRequest>(
    `/api/plugins/installations/${segment(installationId)}/debug`,
    data,
  )
}

export function deletePluginInstallation(installationId: string) {
  return del<void>(`/api/plugins/installations/${segment(installationId)}`)
}

export function getPluginInstallationNotificationChannels(installationId: string) {
  return get<string[]>(
    `/api/plugins/installations/${segment(installationId)}/notification-channels`,
  )
}

export function replacePluginInstallationNotificationChannels(
  installationId: string,
  channelIds: string[],
) {
  return put<string[], { channelIds: string[] }>(
    `/api/plugins/installations/${segment(installationId)}/notification-channels`,
    { channelIds },
  )
}

export function listPluginOptions(params: PluginOptionQuery) {
  return get<PageResponse<PluginOptionItem>>('/api/plugins/options', { params })
}

export function listPluginDependencies(pluginId: string) {
  return get<PluginDependency[]>(`/api/plugins/definitions/${segment(pluginId)}/dependencies`)
}

export function installPluginDependencies(pluginId: string, data: PluginDependencyInstallRequest) {
  return post<PluginDependencyInstallResponse, PluginDependencyInstallRequest>(
    `/api/plugins/definitions/${segment(pluginId)}/dependencies/install`,
    data,
  )
}

export function reinstallPluginDependencies(pluginId: string) {
  return post<PluginDependencyInstallResponse>(
    `/api/plugins/definitions/${segment(pluginId)}/dependencies/reinstall`,
  )
}

export function uninstallPluginDependencies(
  pluginId: string,
  data: PluginDependencyUninstallRequest,
) {
  return del<PluginDependencyInstallResponse>(
    `/api/plugins/definitions/${segment(pluginId)}/dependencies`,
    { data },
  )
}

export function listLocalPluginDependencyArtifacts(params: LocalPluginDependencyArtifactQuery) {
  return get<PageResponse<LocalPluginDependencyArtifact>>(
    '/api/plugins/dependencies/local-artifacts',
    { params },
  )
}

export function uploadLocalPluginDependencyArtifact(data: LocalPluginDependencyUploadPayload) {
  const formData = new FormData()
  formData.append('file', data.file)
  formData.append('groupId', data.groupId)
  formData.append('artifactId', data.artifactId)
  formData.append('version', data.version)
  return post<LocalPluginDependencyUploadResponse, FormData>(
    '/api/plugins/dependencies/local-artifacts',
    formData,
    { timeout: 10 * 60 * 1000 },
  )
}

export function getPluginConfig(installationId: string) {
  return get<PluginConfigResponse>(`/api/plugins/installations/${segment(installationId)}/config`)
}

export function updatePluginConfig(installationId: string, configJson: string) {
  return put<PluginConfigResponse, { configJson: string }>(
    `/api/plugins/installations/${segment(installationId)}/config`,
    { configJson },
  )
}

export function listPluginAccounts(installationId: string, params: PluginAccountQuery) {
  return get<PageResponse<PluginAccountListItem>>(
    `/api/plugins/installations/${segment(installationId)}/accounts`,
    { params },
  )
}

export function getPluginAccountViewPreference(installationId: string) {
  return get<PluginAccountViewPreference>(
    `/api/plugins/installations/${segment(installationId)}/accounts/view-preference`,
  )
}

export function listPluginAccountGroups(installationId: string) {
  return get<PluginAccountGroup[]>(
    `/api/plugins/installations/${segment(installationId)}/account-groups`,
  )
}

export function createPluginAccountGroup(installationId: string, name: string) {
  return post<PluginAccountGroup, { name: string }>(
    `/api/plugins/installations/${segment(installationId)}/account-groups`,
    { name },
  )
}

export function renamePluginAccountGroup(installationId: string, groupId: number, name: string) {
  return put<PluginAccountGroup, { name: string }>(
    `/api/plugins/installations/${segment(installationId)}/account-groups/${segment(groupId)}`,
    { name },
  )
}

export function deletePluginAccountGroup(installationId: string, groupId: number) {
  return del<{ success: boolean }>(
    `/api/plugins/installations/${segment(installationId)}/account-groups/${segment(groupId)}`,
  )
}

export function updatePluginAccountGroup(
  installationId: string,
  accountId: ID,
  data: UpdatePluginAccountGroupRequest,
) {
  return patch<PluginAccountDetail, UpdatePluginAccountGroupRequest>(
    `/api/plugins/installations/${segment(installationId)}/accounts/${segment(accountId)}/group`,
    data,
  )
}

export function batchUpdatePluginAccountsGroup(
  installationId: string,
  data: BatchUpdatePluginAccountGroupRequest,
) {
  return patch<BatchUpdatePluginAccountGroupResponse, BatchUpdatePluginAccountGroupRequest>(
    `/api/plugins/installations/${segment(installationId)}/accounts/group`,
    data,
  )
}

export function updatePluginAccountViewPreference(
  installationId: string,
  data: UpdatePluginAccountViewPreferenceRequest,
) {
  return put<PluginAccountViewPreference, UpdatePluginAccountViewPreferenceRequest>(
    `/api/plugins/installations/${segment(installationId)}/accounts/view-preference`,
    data,
  )
}

export function exportPluginAccounts(installationId: string, params: PluginAccountExportQuery) {
  return get<Blob>(`/api/plugins/installations/${segment(installationId)}/accounts/export`, {
    params,
    responseType: 'blob',
    timeout: 2 * 60 * 1000,
  })
}

export function importPluginAccounts(
  installationId: string,
  file: File,
  params: PluginAccountImportQuery,
) {
  const formData = new FormData()
  formData.append('file', file)
  return post<PluginAccountImportResult, FormData>(
    `/api/plugins/installations/${segment(installationId)}/accounts/import`,
    formData,
    { params, timeout: 2 * 60 * 1000 },
  )
}

export function getPluginAccountSchema(installationId: string) {
  return get<PluginAccountSchemaResponse>(
    `/api/plugins/installations/${segment(installationId)}/accounts/schema`,
  )
}

export function getPluginAccount(installationId: string, accountId: ID) {
  return get<PluginAccountDetail>(
    `/api/plugins/installations/${segment(installationId)}/accounts/${segment(accountId)}`,
  )
}

export function createPluginAccount(installationId: string, data: PluginAccountPayload) {
  return post<PluginAccountDetail, PluginAccountPayload>(
    `/api/plugins/installations/${segment(installationId)}/accounts`,
    data,
  )
}

export function updatePluginAccount(
  installationId: string,
  accountId: ID,
  data: PluginAccountPayload,
) {
  return put<PluginAccountDetail, PluginAccountPayload>(
    `/api/plugins/installations/${segment(installationId)}/accounts/${segment(accountId)}`,
    data,
  )
}

export function setPluginAccountEnabled(installationId: string, accountId: ID, enabled: boolean) {
  return patch<PluginAccountDetail, { enabled: boolean }>(
    `/api/plugins/installations/${segment(installationId)}/accounts/${segment(accountId)}/enabled`,
    { enabled },
  )
}

export function batchUpdatePluginAccountsEnabled(
  installationId: string,
  data: BatchUpdatePluginAccountStateRequest,
) {
  return patch<BatchUpdatePluginAccountStateResponse, BatchUpdatePluginAccountStateRequest>(
    `/api/plugins/installations/${segment(installationId)}/accounts/enabled`,
    data,
  )
}

export function batchDeletePluginAccounts(
  installationId: string,
  data: BatchDeletePluginAccountRequest,
) {
  return del<BatchDeletePluginAccountResponse, BatchDeletePluginAccountRequest>(
    `/api/plugins/installations/${segment(installationId)}/accounts`,
    { data },
  )
}

export function deletePluginAccount(installationId: string, accountId: ID) {
  return del<void>(
    `/api/plugins/installations/${segment(installationId)}/accounts/${segment(accountId)}`,
  )
}

export function listPluginServicePermissions(params: PluginServicePermissionQuery) {
  return get<PageResponse<PluginServicePermissionItem>>('/api/plugin-service/permissions', {
    params,
  })
}

export function getPluginServicePermission(id: ID) {
  return get<PluginServicePermissionItem>(`/api/plugin-service/permissions/${segment(id)}`)
}

export function savePluginServicePermission(data: UpsertPluginServicePermissionRequest) {
  return post<PluginServicePermissionItem, UpsertPluginServicePermissionRequest>(
    '/api/plugin-service/permissions',
    data,
  )
}

export function savePluginServicePermissionsBatch(data: BatchUpsertPluginServicePermissionRequest) {
  return post<PluginServicePermissionItem[], BatchUpsertPluginServicePermissionRequest>(
    '/api/plugin-service/permissions/batch',
    data,
  )
}

export function setPluginServicePermissionEnabled(id: ID, enabled: boolean) {
  return patch<PluginServicePermissionItem, { enabled: boolean }>(
    `/api/plugin-service/permissions/${segment(id)}/enabled`,
    { enabled },
  )
}

export function deletePluginServicePermission(id: ID) {
  return del<{ success: boolean }>(`/api/plugin-service/permissions/${segment(id)}`)
}

export function listPluginServiceCalls(params: PluginServiceCallQuery) {
  return get<PageResponse<PluginServiceCallLog>>('/api/plugin-service/calls', { params })
}

export function getPluginServiceCall(id: ID) {
  return get<PluginServiceCallLog>(`/api/plugin-service/calls/${segment(id)}`)
}

export function getPluginServiceCallRunnerLog(id: ID, params?: PluginServiceCallRunnerLogQuery) {
  return get<PluginServiceCallRunnerLog>(`/api/plugin-service/calls/${segment(id)}/logs`, {
    params,
  })
}

export function listPluginAuditLogs(params: PluginAuditLogQuery) {
  return get<PageResponse<PluginAuditLogItem>>('/api/plugins/audit-logs', { params })
}
