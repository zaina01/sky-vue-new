import type { ID, PageQuery } from './common'

export type JobExecutionStatus =
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'SYSTEM_EXIT'
export type JobStatus = 'ENABLED' | 'DISABLED'
export type ExecutedStatus = 'IDLE' | 'RUNNING'
export type MisfirePolicy = 'DEFAULT' | 'IGNORE_MISFIRES' | 'FIRE_AND_PROCEED' | 'DO_NOTHING'

export interface JobItem {
  id: number
  jobName: string
  pluginInstallationId: string
  pluginId: string
  pluginDisplayName: string
  notificationChannelIds: string[]
  ownerUserId: string
  ownerUsername: string
  ownerDepartmentId: number | null
  ownerDepartmentName: string | null
  cronExpression: string
  misfirePolicy: MisfirePolicy
  inputJson: string
  timeoutMillis: number
  concurrent: boolean
  jobStatus: JobStatus
  executedStatus?: ExecutedStatus
  remark?: string
  createdBy?: string
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

export type JobQuery = PageQuery

export interface UpdateJobRequest {
  jobName: string
  pluginInstallationId: string
  cronExpression: string
  misfirePolicy: MisfirePolicy
  inputJson: string
  timeoutMillis: number
  concurrent: boolean
  remark?: string
}

export interface CreateJobRequest extends UpdateJobRequest {
  notificationChannelIds: string[]
}

export interface ReplaceJobNotificationChannelsRequest {
  channelIds: string[]
}

export interface RunJobPayload {
  inputJson?: string
  timeoutMillis?: number
}

export interface RunJobResult {
  executionId: ID
}

export interface CronNextQuery {
  expression: string
  count?: number
}

export interface CronValidationResponse {
  valid: boolean
  message: string
}

export interface JobExecutionItem {
  id: ID
  jobId: ID
  pluginId: string
  pluginInstallationId: string
  ownerUserId: string
  ownerDepartmentId: number | null
  ownerDepartmentName?: string | null
  instanceId?: string
  requestId?: string
  status: JobExecutionStatus
  triggerType?: string
  jobName: string
  startedAt?: string
  finishedAt?: string
  durationMillis?: number
  message?: string
  createdAt?: string
}

export interface JobExecutionDetail extends JobExecutionItem {
  resultJson?: string | null
  errorType?: string | null
  errorMessage?: string | null
  runnerLogPath?: string | null
}

export interface PluginTaskLogItem {
  id: ID
  pluginId: string
  pluginInstallationId: string
  ownerUserId: string
  ownerDepartmentId: number | null
  instanceId?: string
  jobId: ID | string
  requestId?: string
  level: string
  message: string
  sequenceNo?: number
  eventTime?: string
  createdAt?: string
}

export interface ExecutionLogQuery {
  offset?: number
  limitBytes?: number
  tailBytes?: number
}

export interface ExecutionLogChunk {
  executionId: ID
  pluginId?: string
  pluginInstallationId?: string
  ownerUserId?: string
  ownerDepartmentId?: number | null
  instanceId?: string
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

export interface JobExecutionQuery extends PageQuery {
  jobId?: ID | ''
  pluginInstallationId?: string
  pluginId?: string
  status?: JobExecutionStatus | ''
  startTime?: string
  endTime?: string
}
