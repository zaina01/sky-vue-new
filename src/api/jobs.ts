import { del, get, post, put } from './request'
import type { ID, PageResponse } from '@/types/common'
import type {
  CreateJobRequest,
  CronNextQuery,
  CronValidationResponse,
  ExecutionLogChunk,
  ExecutionLogQuery,
  JobExecutionDetail,
  JobExecutionItem,
  JobExecutionQuery,
  JobItem,
  JobQuery,
  ReplaceJobNotificationChannelsRequest,
  RunJobPayload,
  RunJobResult,
  UpdateJobRequest,
} from '@/types/jobs'

export function listJobs(params: JobQuery) {
  return get<PageResponse<JobItem>>('/api/jobs', { params })
}

export function getJob(id: ID) {
  return get<JobItem>(`/api/jobs/${id}`)
}

export function createJob(data: CreateJobRequest) {
  return post<JobItem, CreateJobRequest>('/api/jobs', data)
}

export function updateJob(id: ID, data: UpdateJobRequest) {
  return put<JobItem, UpdateJobRequest>(`/api/jobs/${id}`, data)
}

export function replaceJobNotificationChannels(id: ID, channelIds: string[]) {
  const data: ReplaceJobNotificationChannelsRequest = { channelIds }
  return put<JobItem, ReplaceJobNotificationChannelsRequest>(
    `/api/jobs/${id}/notification-channels`,
    data,
  )
}

export function deleteJob(id: ID) {
  return del<{ success: boolean }>(`/api/jobs/${id}`)
}

export function pauseJob(id: ID) {
  return post<JobItem>(`/api/jobs/${id}/pause`)
}

export function resumeJob(id: ID) {
  return post<JobItem>(`/api/jobs/${id}/resume`)
}

export function runJob(id: ID, data?: RunJobPayload) {
  return post<RunJobResult, RunJobPayload | undefined>(`/api/jobs/${id}/run`, data)
}

export function validateCronExpression(expression: string) {
  return get<CronValidationResponse>('/api/jobs/cron/validate', { params: { expression } })
}

export function previewCronNext(params: CronNextQuery) {
  return get<string[]>('/api/jobs/cron/next', { params })
}

export function listJobExecutions(id: ID, params: JobExecutionQuery) {
  return get<PageResponse<JobExecutionItem>>(`/api/jobs/${id}/executions`, { params })
}

export function listExecutions(params: JobExecutionQuery) {
  return get<PageResponse<JobExecutionItem>>('/api/job-executions', { params })
}

export function getExecution(id: ID) {
  return get<JobExecutionDetail>(`/api/job-executions/${id}`)
}

export function cancelExecution(id: ID) {
  return post<JobExecutionDetail>(`/api/job-executions/${id}/cancel`)
}

export function getExecutionLogs(id: ID, params: ExecutionLogQuery) {
  return get<ExecutionLogChunk>(`/api/job-executions/${id}/logs`, { params })
}
