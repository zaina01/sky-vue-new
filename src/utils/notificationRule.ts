import type { ID } from '@/types/common'
import type { JobItem } from '@/types/jobs'

export function stringifyNotificationRuleJobId(jobId: ID | '' | null | undefined) {
  return jobId === '' || jobId === null || jobId === undefined ? '' : String(jobId)
}

export function findRuleJob(jobs: JobItem[], jobId: ID | '' | null | undefined) {
  const normalized = stringifyNotificationRuleJobId(jobId)
  return normalized ? jobs.find((item) => String(item.id) === normalized) : undefined
}
