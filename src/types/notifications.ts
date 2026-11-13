import type { ID, PageQuery } from './common'

export type NotificationChannelType = 'WEBHOOK' | 'PUSHPLUS'
export type NotificationEventType =
  | 'JOB_EXECUTION_SUCCESS'
  | 'JOB_EXECUTION_FAILED'
  | 'JOB_EXECUTION_TIMEOUT'
  | 'JOB_EXECUTION_CANCELLED'
  | 'PLUGIN_RUNTIME_START_FAILED'
export type NotificationSendStatus =
  | 'PENDING'
  | 'SENDING'
  | 'RETRY_WAITING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
export type NotificationSourceType = 'HOST_ALERT' | 'PLUGIN_RUNTIME' | 'ADMIN_TEST'

export interface NotificationChannelItem {
  channelId: string
  displayName: string
  channelType: NotificationChannelType
  enabled: boolean
  configMaskedJson?: string
  remark?: string | null
  ownerUserId: string
  ownerUsername: string
  ownerDepartmentId: number | null
  ownerDepartmentName: string | null
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface NotificationChannelCreatePayload {
  channelId: string
  displayName?: string
  channelType: NotificationChannelType
  enabled?: boolean
  configJson: string
  remark?: string
}

export type NotificationChannelUpdatePayload = Omit<NotificationChannelCreatePayload, 'channelId'>
export type NotificationChannelPayload = NotificationChannelCreatePayload

export interface NotificationChannelQuery extends PageQuery {
  channelType?: NotificationChannelType | ''
  enabled?: boolean | ''
  channelId?: string
  displayName?: string
}

export interface SendNotificationTestRequest {
  title: string
  content: string
  severity?: string
}

export interface NotificationChannelTestResult {
  channelId: ID
  status: NotificationSendStatus
  message?: string
  historyId?: ID
}

export interface NotificationRuleItem {
  ruleId: string
  displayName: string
  enabled: boolean
  eventType: NotificationEventType
  pluginInstallationId: string
  pluginId: string
  jobId: string
  severity?: string
  channelIds: string[]
  ownerUserId: string
  ownerUsername: string
  ownerDepartmentId: number | null
  ownerDepartmentName: string | null
  remark?: string | null
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface NotificationRulePayload {
  ruleId?: string
  displayName: string
  enabled: boolean
  eventType: NotificationEventType
  pluginInstallationId: string
  jobId: string
  severity: string
  channelIds: string[]
  remark: string
}

export type NotificationRuleUpdatePayload = Omit<NotificationRulePayload, 'ruleId'>

export interface NotificationRuleQuery extends PageQuery {
  eventType?: NotificationEventType | ''
  enabled?: boolean | ''
  pluginInstallationId?: string
  jobId?: string
}

export interface NotificationHistoryItem {
  id: ID
  requestId?: string
  sourceType: NotificationSourceType
  pluginId?: string
  installationId?: string
  instanceId?: string
  jobId?: ID
  executionId?: ID | null
  channelId: ID
  channelType: NotificationChannelType
  title?: string
  contentPreview?: string
  payloadBytes?: number
  status: NotificationSendStatus
  attemptCount?: number
  maxAttempts?: number
  nextRetryAt?: string | null
  firstAttemptAt?: string | null
  lastAttemptAt?: string | null
  manualRetryCount?: number
  lastManualRetryAt?: string | null
  lastManualRetryBy?: string | null
  errorType?: string | null
  errorMessage?: string | null
  providerStatusCode?: string | null
  providerMessage?: string | null
  createdAt: string
  sentAt?: string | null
  sourceOwnerUserId?: string | null
  sourceOwnerDepartmentId?: number | null
  channelOwnerUserId?: string | null
  channelOwnerDepartmentId?: number | null
}

export interface NotificationHistoryQuery extends PageQuery {
  sourceType?: NotificationSourceType | ''
  channelId?: ID | ''
  channelType?: NotificationChannelType | ''
  status?: NotificationSendStatus | ''
  installationId?: string
  pluginId?: string
  jobId?: ID | ''
  executionId?: ID | ''
  startTime?: string
  endTime?: string
}
