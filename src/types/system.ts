import type { ID, PageQuery } from './common'

export interface SuccessResult {
  success: boolean
}

export interface SystemOverviewQuery {
  windowHours?: number
  trendDays?: number
  recentLimit?: number
}

export type PluginRuntimeState = 'STARTING' | 'RUNNING' | 'STOPPED' | 'FAILED'

export type JobStatus = 'ENABLED' | 'DISABLED'

export type ExecutedStatus = 'IDLE' | 'RUNNING'

export type JobExecutionStatus =
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'SYSTEM_EXIT'

export type NotificationSendStatus =
  | 'PENDING'
  | 'SENDING'
  | 'RETRY_WAITING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'

export type NotificationSourceType = 'HOST_ALERT' | 'PLUGIN_RUNTIME' | 'ADMIN_TEST'

export type NotificationChannelType = 'WEBHOOK' | 'PUSHPLUS'

export interface SystemOverviewWindow {
  windowHours: number
  startTime: string
  endTime: string
  trendDays: number
  recentLimit: number
}

export interface SystemOverviewStatusCount<TStatus extends string = string> {
  status: TStatus
  count: number
}

export interface SystemOverviewTrendPoint<TStatus extends string = string> {
  date: string
  status: TStatus
  count: number
}

export interface SystemOverviewRecentJobExecutionFailure {
  id: ID
  jobId: ID
  jobName: string
  pluginId: string
  instanceId: string
  status: JobExecutionStatus
  errorType?: string | null
  errorMessage?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  durationMillis?: number | null
  runnerLogPath?: string | null
}

export interface SystemOverviewRecentNotificationFailure {
  id: ID
  requestId: string
  sourceType: NotificationSourceType
  pluginId?: string | null
  instanceId?: string | null
  jobId?: ID | null
  executionId?: ID | null
  channelId: ID
  channelType: NotificationChannelType
  title: string
  errorType?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  sentAt?: string | null
}

export interface SystemOverviewResponse {
  uploadedPlugins: number
  enabledJobs: number
  failedExecutions: number
  pendingRetryNotifications: number
  window: SystemOverviewWindow
  pluginRuntimeStates: SystemOverviewStatusCount<PluginRuntimeState>[]
  jobStatuses: SystemOverviewStatusCount<JobStatus>[]
  jobExecutedStatuses: SystemOverviewStatusCount<ExecutedStatus>[]
  executionStatusesInWindow: SystemOverviewStatusCount<JobExecutionStatus>[]
  notificationStatusesInWindow: SystemOverviewStatusCount<NotificationSendStatus>[]
  trends: {
    jobExecutions: SystemOverviewTrendPoint<JobExecutionStatus>[]
    notifications: SystemOverviewTrendPoint<NotificationSendStatus>[]
  }
  recentFailures: {
    jobExecutions: SystemOverviewRecentJobExecutionFailure[]
    notifications: SystemOverviewRecentNotificationFailure[]
  }
}

export interface UserItem {
  userId: string
  username: string
  email: string
  phone?: string | null
  avatar?: string | null
  departmentId: number | null
  departmentName: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  roles: string[]
  permissions: string[]
}

export interface UserQuery extends PageQuery {
  username?: string
  enabled?: boolean | ''
  departmentId?: number | ''
}

export interface UserCreatePayload {
  username: string
  password: string
  email: string
  phone?: string
  avatar?: string
  departmentId: number
  enabled?: boolean
  roles: string[]
}

export interface UserUpdatePayload {
  email: string
  phone?: string
  avatar?: string
  departmentId: number
  enabled?: boolean
}

export interface UserRolesPayload {
  roles?: string[]
}

export interface ResetUserPasswordPayload {
  password: string
}

export type DataScopeType = 'ALL' | 'CUSTOM' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'SELF'

export interface RoleItem {
  roleId: number
  roleName: string
  description?: string
  dataScope: DataScopeType
  departmentIds: number[]
  createdAt: string
  permissions: string[]
}

export interface RoleQuery extends PageQuery {
  roleName?: string
}

export interface RolePayload {
  roleName: string
  description?: string
}

export interface RolePermissionsPayload {
  permissions?: string[]
}

export interface ReplaceRoleDataScopeRequest {
  dataScope: DataScopeType
  departmentIds: number[]
}

export interface DepartmentQuery {
  departmentName?: string
  enabled?: boolean | ''
}

export interface UpsertDepartmentRequest {
  parentId: number | null
  departmentName: string
  sortOrder: number
  enabled: boolean
}

export interface DepartmentResponse {
  departmentId: number
  parentId: number | null
  departmentName: string
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  children: DepartmentResponse[]
}

export interface DataOwnershipTransferRequest {
  targetUserId: string
  targetDepartmentId?: number
  pluginInstallationIds: string[]
  jobIds: number[]
  notificationChannelIds: string[]
  notificationRuleIds: string[]
}

export interface DataOwnershipTransferResponse {
  targetUserId: string
  targetUsername: string
  targetDepartmentId: number
  targetDepartmentName: string
  pluginInstallationsTransferred: number
  jobsTransferred: number
  notificationChannelsTransferred: number
  notificationRulesTransferred: number
}

export interface PermissionItem {
  permissionId: ID
  permissionName: string
  description?: string
}

export interface PermissionQuery extends PageQuery {
  permissionName?: string
}

export type SystemSettingCategory =
  | 'RETENTION'
  | 'NOTIFICATION'
  | 'PLUGIN_STORAGE'
  | 'PLUGIN_UPLOAD'
  | 'PLUGIN_RUNTIME'
  | 'SECURITY'

export type SystemSettingValueType =
  | 'BOOLEAN'
  | 'INTEGER'
  | 'LONG'
  | 'DURATION'
  | 'CRON'
  | 'STRING'
  | 'STRING_LIST'

export interface SystemSettingItem {
  key: string
  category: SystemSettingCategory
  valueType: SystemSettingValueType
  value: unknown
  valueText?: string | null
  displayName?: string | null
  description?: string | null
  unit?: string | null
  group?: string | null
  placeholder?: string | null
  min?: unknown
  max?: unknown
  editable: boolean
  updatedAt?: string | null
}

export interface SystemSettingQuery {
  category?: SystemSettingCategory
}

export interface SystemSettingUpdatePayload {
  value: unknown
}

export interface SystemSettingsBatchUpdatePayload {
  values: Record<string, unknown>
}

export interface SystemLogItem {
  id: ID
  module: string
  action: string
  level: string
  status: string
  operatorUserId?: string | null
  operatorName?: string | null
  ownerDepartmentId?: number | null
  sourceType: string
  requestUri: string
  requestMethod: string
  ip: string
  userAgent: string
  targetType: string
  targetId: string
  message: string
  detail?: string | null
  remark?: string | null
  createTime: string
}

export interface LoginLogItem {
  id: ID
  userId?: string | null
  username: string
  ownerDepartmentId?: number | null
  status: string
  loginTime: string
  deviceType: string
  loginIp: string
  ipType: string
  userAgent: string
  failReason?: string | null
  requestUri: string
  requestMethod: string
  remark?: string | null
}

export interface SystemLogQuery extends PageQuery {
  module?: string
  action?: string
  level?: string
  status?: string
  operatorUserId?: string
  operatorName?: string
  sourceType?: string
  targetType?: string
  targetId?: string
  startTime?: string
  endTime?: string
}

export interface LoginLogQuery extends PageQuery {
  username?: string
  userId?: string
  status?: string
  loginIp?: string
  deviceType?: string
  startTime?: string
  endTime?: string
}

export type RetentionCleanupCategory =
  | 'JOB_EXECUTION'
  | 'PLUGIN_TASK_LOG'
  | 'PLUGIN_AUDIT_LOG'
  | 'LOGIN_LOG'
  | 'SYSTEM_LOG'
  | 'NOTIFICATION_SEND_HISTORY'

export interface RetentionCleanupRequest {
  dryRun?: boolean
  confirm?: boolean
  categories?: RetentionCleanupCategory[]
}

export interface RetentionCleanupItem {
  category: RetentionCleanupCategory
  cutoff: string
  retentionDays: number
  dryRun: boolean
  candidateCount: number
  deletedCount: number
  skippedReason: string
}

export interface RetentionCleanupResponse {
  enabled: boolean
  dryRun: boolean
  startedAt: string
  finishedAt: string
  totalCandidateCount: number
  totalDeletedCount: number
  items: RetentionCleanupItem[]
}
