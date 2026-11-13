import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createJob,
  getExecution,
  replaceJobNotificationChannels,
  runJob,
  updateJob,
} from '@/api/jobs'
import { createRule, listAllChannels, listHistory, listRules } from '@/api/notifications'
import { get, post, put } from '@/api/request'
import type { CreateJobRequest, UpdateJobRequest } from '@/types/jobs'
import type { NotificationRulePayload } from '@/types/notifications'

vi.mock('@/api/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const getMock = vi.mocked(get)
const postMock = vi.mocked(post)
const putMock = vi.mocked(put)

const updatePayload: UpdateJobRequest = {
  jobName: '同步任务',
  pluginInstallationId: 'installation-a',
  cronExpression: '0 0/5 * * * ?',
  misfirePolicy: 'DO_NOTHING',
  concurrent: false,
  inputJson: '{}',
  timeoutMillis: 60_000,
  remark: 'demo',
}

describe('job and notification installation contracts', () => {
  beforeEach(() => {
    getMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
    postMock.mockResolvedValue({})
    putMock.mockResolvedValue({})
  })

  it('creates a job with pluginInstallationId and channel IDs', async () => {
    const payload: CreateJobRequest = {
      ...updatePayload,
      notificationChannelIds: ['channel-1'],
    }

    await createJob(payload)

    expect(postMock).toHaveBeenCalledWith('/api/jobs', payload)
    expect(postMock.mock.calls[0]?.[1]).not.toHaveProperty('pluginId')
  })

  it('keeps normal updates and channel replacement as separate requests', async () => {
    await updateJob(12, updatePayload)
    await replaceJobNotificationChannels(12, ['channel-2'])

    expect(putMock).toHaveBeenNthCalledWith(1, '/api/jobs/12', updatePayload)
    expect(putMock).toHaveBeenNthCalledWith(2, '/api/jobs/12/notification-channels', {
      channelIds: ['channel-2'],
    })
    expect(putMock.mock.calls[0]?.[1]).not.toHaveProperty('notificationChannelIds')
  })

  it('uses pluginInstallationId and a string jobId for notification rules', async () => {
    const payload: NotificationRulePayload = {
      ruleId: 'rule-1',
      displayName: '失败通知',
      enabled: true,
      eventType: 'JOB_EXECUTION_FAILED',
      pluginInstallationId: 'installation-a',
      jobId: String(12),
      severity: 'ERROR',
      channelIds: ['channel-independent-from-push-pool'],
      remark: '',
    }

    await createRule(payload)
    await listRules({
      page: 1,
      size: 10,
      pluginInstallationId: 'installation-a',
      jobId: '12',
      eventType: 'PLUGIN_RUNTIME_START_FAILED',
    })

    expect(postMock).toHaveBeenCalledWith('/api/notifications/rules', payload)
    expect(postMock.mock.calls[0]?.[1]).not.toHaveProperty('pluginId')
    expect(getMock).toHaveBeenCalledWith('/api/notifications/rules', {
      params: {
        page: 1,
        size: 10,
        pluginInstallationId: 'installation-a',
        jobId: '12',
        eventType: 'PLUGIN_RUNTIME_START_FAILED',
      },
    })
  })

  it('keeps the history query field named installationId', async () => {
    await listHistory({ page: 3, size: 20, installationId: 'installation-a', pluginId: 'demo' })

    expect(getMock).toHaveBeenCalledWith('/api/notifications/history', {
      params: { page: 3, size: 20, installationId: 'installation-a', pluginId: 'demo' },
    })
  })

  it('loads every readable notification-channel page in batches of 100', async () => {
    const channel = (channelId: string) => ({
      channelId,
      displayName: channelId,
      channelType: 'WEBHOOK' as const,
      enabled: true,
      ownerUserId: 'user-1',
      ownerUsername: 'admin',
      ownerDepartmentId: null,
      ownerDepartmentName: null,
    })
    getMock
      .mockResolvedValueOnce({ items: [channel('channel-1')], page: 1, size: 100, total: 201 })
      .mockResolvedValueOnce({ items: [channel('channel-101')], page: 2, size: 100, total: 201 })
      .mockResolvedValueOnce({ items: [channel('channel-201')], page: 3, size: 100, total: 201 })

    const result = await listAllChannels()

    expect(result.map((item) => item.channelId)).toEqual([
      'channel-1',
      'channel-101',
      'channel-201',
    ])
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/notifications/channels', {
      params: { page: 1, size: 100 },
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/notifications/channels', {
      params: { page: 2, size: 100 },
    })
    expect(getMock).toHaveBeenNthCalledWith(3, '/api/notifications/channels', {
      params: { page: 3, size: 100 },
    })
  })

  it('submits a SERVICE installation in inputJson and polls the returned executionId', async () => {
    const inputJson = JSON.stringify({ serviceInstallationId: 'service-installation' })
    postMock.mockResolvedValueOnce({ executionId: 73 })
    getMock
      .mockResolvedValueOnce({ id: 73, status: 'RUNNING' })
      .mockResolvedValueOnce({ id: 73, status: 'SUCCESS' })

    const run = await runJob(1, { inputJson, timeoutMillis: 30_000 })
    const running = await getExecution(run.executionId)
    const completed = running.status === 'RUNNING' ? await getExecution(run.executionId) : running

    expect(postMock).toHaveBeenCalledWith('/api/jobs/1/run', {
      inputJson: '{"serviceInstallationId":"service-installation"}',
      timeoutMillis: 30_000,
    })
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/job-executions/73')
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/job-executions/73')
    expect(completed.status).toBe('SUCCESS')
  })
})
