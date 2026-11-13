import { del, get, patch, post, put } from './request'
import type { ID, PageResponse } from '@/types/common'
import type {
  NotificationChannelCreatePayload,
  NotificationChannelItem,
  NotificationChannelQuery,
  NotificationChannelTestResult,
  NotificationChannelUpdatePayload,
  NotificationHistoryItem,
  NotificationHistoryQuery,
  NotificationRuleItem,
  NotificationRulePayload,
  NotificationRuleQuery,
  NotificationRuleUpdatePayload,
  SendNotificationTestRequest,
} from '@/types/notifications'

export function listChannels(params: NotificationChannelQuery) {
  return get<PageResponse<NotificationChannelItem>>('/api/notifications/channels', { params })
}

export async function listAllChannels() {
  const size = 100
  const first = await listChannels({ page: 1, size })
  const items = [...first.items]
  const totalPages = Math.ceil(first.total / size)
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await listChannels({ page, size })
    items.push(...response.items)
  }
  return items
}

export function getChannel(channelId: ID) {
  return get<NotificationChannelItem>(`/api/notifications/channels/${channelId}`)
}

export function createChannel(data: NotificationChannelCreatePayload) {
  return post<void, NotificationChannelCreatePayload>('/api/notifications/channels', data)
}

export function updateChannel(channelId: ID, data: NotificationChannelUpdatePayload) {
  return put<void, NotificationChannelUpdatePayload>(
    `/api/notifications/channels/${channelId}`,
    data,
  )
}

export function setChannelEnabled(channelId: ID, enabled: boolean) {
  return patch<void, { enabled: boolean }>(`/api/notifications/channels/${channelId}/enabled`, {
    enabled,
  })
}

export function deleteChannel(channelId: ID) {
  return del<void>(`/api/notifications/channels/${channelId}`)
}

export function testChannel(channelId: ID, data: SendNotificationTestRequest) {
  return post<NotificationChannelTestResult[], SendNotificationTestRequest>(
    `/api/notifications/channels/${channelId}/test`,
    data,
  )
}

export function listRules(params: NotificationRuleQuery) {
  return get<PageResponse<NotificationRuleItem>>('/api/notifications/rules', { params })
}

export function getRule(ruleId: ID) {
  return get<NotificationRuleItem>(`/api/notifications/rules/${ruleId}`)
}

export function createRule(data: NotificationRulePayload) {
  return post<void, NotificationRulePayload>('/api/notifications/rules', data)
}

export function updateRule(ruleId: ID, data: NotificationRuleUpdatePayload) {
  return put<void, NotificationRuleUpdatePayload>(`/api/notifications/rules/${ruleId}`, data)
}

export function setRuleEnabled(ruleId: ID, enabled: boolean) {
  return patch<void, { enabled: boolean }>(`/api/notifications/rules/${ruleId}/enabled`, {
    enabled,
  })
}

export function deleteRule(ruleId: ID) {
  return del<void>(`/api/notifications/rules/${ruleId}`)
}

export function listHistory(params: NotificationHistoryQuery) {
  return get<PageResponse<NotificationHistoryItem>>('/api/notifications/history', { params })
}

export function getHistory(id: ID) {
  return get<NotificationHistoryItem>(`/api/notifications/history/${id}`)
}

export function retryHistory(id: ID) {
  return post<void>(`/api/notifications/history/${id}/retry`)
}
