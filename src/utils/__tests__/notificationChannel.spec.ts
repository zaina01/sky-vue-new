import { describe, expect, it } from 'vitest'

import type { NotificationChannelItem } from '@/types/notifications'
import {
  buildNotificationChannelMap,
  buildNotificationChannelNameCounts,
  formatNotificationChannelList,
  formatNotificationChannelListTooltip,
  formatNotificationChannelOptionLabel,
  formatNotificationChannelTooltip,
  resolveNotificationChannelName,
} from '@/utils/notificationChannel'

function channel(channelId: string, displayName: string): NotificationChannelItem {
  return {
    channelId,
    displayName,
    channelType: 'WEBHOOK',
    enabled: true,
    ownerUserId: 'user-1',
    ownerUsername: 'admin',
    ownerDepartmentId: null,
    ownerDepartmentName: null,
  }
}

describe('notification-channel display helpers', () => {
  it('uses trimmed names and falls back to IDs for blank or missing channels', () => {
    const channels = buildNotificationChannelMap([
      channel('channel-a', ' 渠道 A '),
      channel('channel-blank', '   '),
    ])

    expect(resolveNotificationChannelName('channel-a', channels)).toBe('渠道 A')
    expect(resolveNotificationChannelName('channel-blank', channels)).toBe('channel-blank')
    expect(resolveNotificationChannelName('channel-missing', channels)).toBe('channel-missing')
    expect(formatNotificationChannelTooltip('channel-a', channels)).toBe('渠道 A（channel-a）')
    expect(formatNotificationChannelTooltip('channel-missing', channels)).toBe('channel-missing')
  })

  it('formats compact multi-channel text and detailed hover content', () => {
    const channels = buildNotificationChannelMap([channel('channel-a', '渠道 A')])
    const ids = ['channel-a', 'channel-missing']

    expect(formatNotificationChannelList(ids, channels)).toBe('渠道 A、channel-missing')
    expect(formatNotificationChannelListTooltip(ids, channels)).toBe(
      '渠道 A（channel-a）；channel-missing',
    )
    expect(formatNotificationChannelList([], channels)).toBe('-')
    expect(formatNotificationChannelListTooltip(undefined, channels)).toBe('-')
  })

  it('appends IDs only when readable channel names are duplicated', () => {
    const items = [
      channel('channel-a', '同名渠道'),
      channel('channel-b', '同名渠道'),
      channel('channel-c', '唯一渠道'),
    ]
    const channels = buildNotificationChannelMap(items)
    const counts = buildNotificationChannelNameCounts(items)

    expect(formatNotificationChannelOptionLabel('channel-a', channels, counts)).toBe(
      '同名渠道（channel-a）',
    )
    expect(formatNotificationChannelOptionLabel('channel-b', channels, counts)).toBe(
      '同名渠道（channel-b）',
    )
    expect(formatNotificationChannelOptionLabel('channel-c', channels, counts)).toBe('唯一渠道')
    expect(formatNotificationChannelOptionLabel('channel-missing', channels, counts)).toBe(
      'channel-missing',
    )
  })
})
