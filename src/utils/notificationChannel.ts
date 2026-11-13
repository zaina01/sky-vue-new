import type { NotificationChannelItem } from '@/types/notifications'

export type NotificationChannelMap = ReadonlyMap<string, NotificationChannelItem>

function normalizedChannelName(channel?: NotificationChannelItem) {
  return channel?.displayName?.trim() || ''
}

export function buildNotificationChannelMap(channels: NotificationChannelItem[]) {
  return new Map(channels.map((channel) => [channel.channelId, channel]))
}

export function buildNotificationChannelNameCounts(channels: NotificationChannelItem[]) {
  const result = new Map<string, number>()
  for (const channel of channels) {
    const name = normalizedChannelName(channel)
    if (name) result.set(name, (result.get(name) || 0) + 1)
  }
  return result
}

export function resolveNotificationChannelName(
  channelId: string,
  channels: NotificationChannelMap,
) {
  return normalizedChannelName(channels.get(channelId)) || channelId
}

export function formatNotificationChannelTooltip(
  channelId: string,
  channels: NotificationChannelMap,
) {
  const name = normalizedChannelName(channels.get(channelId))
  return name ? `${name}（${channelId}）` : channelId
}

export function formatNotificationChannelList(
  channelIds: readonly string[] | null | undefined,
  channels: NotificationChannelMap,
) {
  if (!channelIds?.length) return '-'
  return channelIds
    .map((channelId) => resolveNotificationChannelName(channelId, channels))
    .join('、')
}

export function formatNotificationChannelListTooltip(
  channelIds: readonly string[] | null | undefined,
  channels: NotificationChannelMap,
) {
  if (!channelIds?.length) return '-'
  return channelIds
    .map((channelId) => formatNotificationChannelTooltip(channelId, channels))
    .join('；')
}

export function formatNotificationChannelOptionLabel(
  channelId: string,
  channels: NotificationChannelMap,
  nameCounts: ReadonlyMap<string, number>,
) {
  const name = normalizedChannelName(channels.get(channelId))
  if (!name) return channelId
  return (nameCounts.get(name) || 0) > 1 ? `${name}（${channelId}）` : name
}
