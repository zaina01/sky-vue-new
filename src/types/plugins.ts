import type { ID, PageQuery } from './common'

export type PluginRuntimeState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'FAILED'

export interface PluginDefinitionResponse {
  pluginId: string
  version: string
  displayName: string
  mainClass: string
  artifactSha256: string
  capabilitiesJson: string
  configSchemaJson: string
  accountSchemaJson: string
  createdAt: string
  updatedAt: string
}

export interface PluginDefinitionQuery extends PageQuery {
  keyword?: string
}

export interface PluginUploadResult {
  pluginId: string
  version: string
  mainClass: string
  artifactSha256: string
  artifactPath: string
  resolvedDependencyCount: number
}

export interface CreatePluginInstallationRequest {
  pluginId: string
  installationName: string
}

export interface PluginInstallationResponse {
  id: number
  installationId: string
  pluginId: string
  instanceId: string
  installationName: string
  version: string
  displayName: string
  mainClass: string
  artifactPath: string
  artifactSha256: string
  runtimeType: string
  state: PluginRuntimeState
  runnerHost: string | null
  runnerPort: number | null
  workDir: string | null
  capabilitiesJson: string
  configSchemaJson: string
  accountSchemaJson: string
  remoteDebugEnabled: boolean
  remoteDebugPort: number
  remoteDebugSuspend: boolean
  managedByCurrentHost: boolean
  liveState: PluginRuntimeState
  ownerUserId: string
  ownerUsername: string
  ownerDepartmentId: number | null
  ownerDepartmentName: string | null
  startedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PluginRuntimeDebugRequest {
  enabled: boolean
  port: number
  suspend: boolean
}

export interface PluginInstallationQuery extends PageQuery {
  pluginId?: string
  state?: PluginRuntimeState | ''
}

export interface PluginDependency {
  groupId: string
  artifactId: string
  version: string
  classifier: string
  extension: string
  relativePath: string
  sha256: string
}

export type PluginDependencyInstallMode = 'merge' | 'replace'

export interface PluginDependencyInstallRequest {
  dependencies: string[]
  mode?: PluginDependencyInstallMode
}

export interface PluginDependencyUninstallRequest {
  dependencies: string[]
}

export interface PluginDependencyInstallResponse {
  pluginId: string
  declaredDependencyCount: number
  resolvedDependencyCount: number
  dependencies: PluginDependency[]
}

export interface LocalPluginDependencyArtifact {
  id: ID
  groupId: string
  artifactId: string
  version: string
  classifier?: string | null
  extension: string
  coordinate: string
  relativePath: string
  sha256: string
  originalFilename?: string | null
  sizeBytes?: number | null
  uploadedBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface LocalPluginDependencyArtifactQuery extends PageQuery {
  keyword?: string
}

export interface LocalPluginDependencyUploadPayload {
  file: File
  groupId: string
  artifactId: string
  version: string
}

export type LocalPluginDependencyUploadResponse = LocalPluginDependencyArtifact

export type PluginOptionUsage =
  | 'JOB'
  | 'CONFIG'
  | 'ACCOUNT'
  | 'NOTIFICATION'
  | 'SERVICE'
  | 'DEPENDENCY'
  | 'AUDIT'
  | 'RUNTIME'

export interface PluginOptionItem {
  installationId: string
  pluginId: string
  installationName: string
  pluginName: string
  version: string
  ownerUserId: string
  ownerDepartmentId: number | null
  state: PluginRuntimeState
}

export interface PluginOptionQuery extends PageQuery {
  keyword?: string
  usage?: PluginOptionUsage | ''
  state?: PluginRuntimeState | ''
}

export interface PluginServicePermissionItem {
  id: number
  callerInstallationId: string
  callerPluginId: string
  targetInstallationId: string
  targetPluginId: string
  operation: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PluginServicePermissionQuery extends PageQuery {
  callerInstallationId?: string
  callerPluginId?: string
  targetInstallationId?: string
  targetPluginId?: string
  operation?: string
  enabled?: boolean | ''
}

export interface UpsertPluginServicePermissionRequest {
  callerInstallationId: string
  targetInstallationId: string
  operation: string
  enabled: boolean
}

export interface BatchUpsertPluginServicePermissionRequest {
  callerInstallationId: string
  targetInstallationId: string
  operations: string[]
  enabled: boolean
}

export interface PluginServiceCallLog {
  id: ID
  executionId?: ID | null
  jobId?: ID | null
  callerInstallationId: string
  callerPluginId: string
  callerOwnerUserId?: string | null
  callerOwnerDepartmentId?: number | null
  callerInstanceId?: string | null
  callerRequestId?: string | null
  targetInstallationId: string
  targetPluginId: string
  targetOwnerUserId?: string | null
  targetOwnerDepartmentId?: number | null
  targetInstanceId?: string | null
  operation: string
  serviceRequestId?: string | null
  targetRunnerLogPath?: string | null
  timeoutMillis?: number | null
  durationMillis?: number | null
  requestBytes?: number | null
  responseBytes?: number | null
  success: boolean
  errorType?: string | null
  errorMessage?: string | null
  createdAt: string
}

export interface PluginServiceCallQuery extends PageQuery {
  jobId?: ID | ''
  callerInstallationId?: string
  callerPluginId?: string
  targetInstallationId?: string
  targetPluginId?: string
  operation?: string
  success?: boolean | ''
}

export interface PluginServiceCallRunnerLogQuery {
  offset?: number
  limitBytes?: number
  tailBytes?: number
}

export interface PluginServiceCallRunnerLog {
  serviceCallLogId: ID
  targetInstallationId?: string | null
  targetPluginId?: string | null
  targetInstanceId?: string | null
  runnerLogPath?: string | null
  exists: boolean
  content: string
  offset: number
  nextOffset: number
  limitBytes: number
  sizeBytes: number
  eof: boolean
  truncated: boolean
}

export type PluginConfigSchemaFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'PASSWORD'
  | 'SWITCH'
  | 'BOOLEAN'
  | 'RADIO'
  | 'SELECT'
  | 'CHECKBOX'
  | 'MULTI_SELECT'
  | 'LIST'
  | 'MAP'
  | 'OBJECT_LIST'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
export type PluginAccountSchemaFieldType = PluginConfigSchemaFieldType

export type PluginSchemaPrimitiveValue = string | number | boolean | null

export interface PluginSchemaOption {
  label?: string
  value: string | number | boolean
}

export type PluginSchemaVisibleWhen =
  | { field: string; equals: PluginSchemaPrimitiveValue }
  | { field: string; in: PluginSchemaPrimitiveValue[] }

export interface PluginSchemaItemSchema {
  fields?: PluginFieldSchema[]
}

export interface PluginFieldSchema {
  name: string
  label: string
  type: PluginConfigSchemaFieldType
  required?: boolean
  sensitive?: boolean
  readonly?: boolean
  accountId?: boolean
  options?: PluginSchemaOption[]
  visibleWhen?: PluginSchemaVisibleWhen
  itemSchema?: PluginSchemaItemSchema
}

export type PluginConfigSchemaItemSchema = PluginSchemaItemSchema
export type PluginConfigSchemaField = PluginFieldSchema
export type PluginAccountSchemaField = PluginFieldSchema

export interface PluginConfigSchema {
  fields: PluginConfigSchemaField[]
}

export interface PluginAccountSchema {
  fields: PluginAccountSchemaField[]
  accountIdField?: string
}

export interface PluginAccountSchemaResponse {
  installationId: string
  pluginId: string
  schema?: PluginAccountSchema
  accountSchema?: PluginAccountSchema
  schemaJson?: string | PluginAccountSchema | null
}

export interface PluginConfigResponse {
  installationId: string
  pluginId: string
  configJson: string
  schema?: PluginConfigSchema
  configSchema?: PluginConfigSchema
  schemaJson?: string | PluginConfigSchema | null
  updatedAt?: string
}

export interface PluginAccountDetail {
  groupId: number | null
  groupName: string | null
  accountId: ID
  installationId: string
  displayName?: string
  accountName?: string
  enabled: boolean
  accountJson?: string
  configJson?: string
  schema?: PluginAccountSchema
  accountSchema?: PluginAccountSchema
  accountIdField?: string
  createdAt?: string
  updatedAt?: string
}

export interface PluginAccountListItem {
  groupId: number | null
  groupName: string | null
  installationId: string
  accountId: string
  displayName: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  displayValues: Record<string, unknown | null>
}

export type PluginAccountListFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'SWITCH'
  | 'RADIO'
  | 'SELECT'
  | 'CHECKBOX'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'

export interface PluginAccountListField {
  name: string
  label: string
  type: PluginAccountListFieldType
  options: string[]
}

export interface PluginAccountViewPreference {
  installationId: string
  fields: string[]
  availableFields: PluginAccountListField[]
  maxFields: number
}

export interface UpdatePluginAccountViewPreferenceRequest {
  fields: string[]
}

export interface PluginAccountPayload {
  groupId?: number | null
  accountId: string
  displayName?: string
  accountJson: string
  enabled?: boolean
}

export interface PluginAccountQuery extends PageQuery {
  groupId?: number
  ungrouped?: boolean
  enabled?: boolean | ''
  accountId?: string
  displayName?: string
}

export type PluginAccountExportFormat = 'csv' | 'xlsx'

export interface PluginAccountExportQuery {
  groupId?: number
  ungrouped?: boolean
  format?: PluginAccountExportFormat
  enabled?: boolean | ''
  accountId?: string
  displayName?: string
  includeSecret?: boolean
}

export interface PluginAccountImportQuery {
  dryRun?: boolean
  enabledDefault?: boolean
}

export interface PluginAccountGroup {
  groupId: number
  name: string
  accountCount: number
  createdAt: string
  updatedAt: string
}

export interface UpdatePluginAccountGroupRequest {
  groupId: number | null
}

export interface BatchUpdatePluginAccountGroupRequest extends UpdatePluginAccountGroupRequest {
  accountIds: string[]
}

export interface BatchUpdatePluginAccountGroupResponse {
  installationId: string
  groupId: number | null
  total: number
  succeeded: number
  failed: number
  receipts: { accountId: string | null; success: boolean; message: string }[]
}

export type PluginAccountImportStatus = 'SUCCESS' | 'FAILED'
export type PluginAccountImportOperation = 'CREATE' | 'UPDATE' | 'NONE'

export interface PluginAccountImportRowResult {
  rowNumber: number
  accountId?: string
  status: PluginAccountImportStatus
  operation: PluginAccountImportOperation
  message?: string
}

export interface PluginAccountImportResult {
  installationId: string
  dryRun: boolean
  totalRows: number
  successRows: number
  failedRows: number
  createdRows: number
  updatedRows: number
  rows: PluginAccountImportRowResult[]
}

export interface BatchUpdatePluginAccountStateRequest {
  accountIds: string[]
  enabled: boolean
}

export interface BatchPluginAccountStateReceipt {
  accountId: string
  success: boolean
  message: string
}

export interface BatchUpdatePluginAccountStateResponse {
  installationId: string
  enabled: boolean
  total: number
  succeeded: number
  failed: number
  receipts: BatchPluginAccountStateReceipt[]
}

export interface BatchDeletePluginAccountRequest {
  accountIds: string[]
}

export interface BatchPluginAccountDeleteReceipt {
  accountId: string | null
  success: boolean
  message: string
}

export interface BatchDeletePluginAccountResponse {
  installationId: string
  total: number
  succeeded: number
  failed: number
  receipts: BatchPluginAccountDeleteReceipt[]
}

export interface PluginAuditLogItem {
  id: ID
  installationId: string
  pluginId: string
  instanceId?: string
  actor?: string
  action: string
  operator?: string
  detailJson?: string
  createdAt: string
}

export interface PluginAuditLogQuery extends PageQuery {
  installationId?: string
  pluginId?: string
  instanceId?: string
  actor?: string
  action?: string
  startTime?: string
  endTime?: string
}

export type PluginConfig = PluginConfigResponse
export type PluginServicePermissionPayload = UpsertPluginServicePermissionRequest
