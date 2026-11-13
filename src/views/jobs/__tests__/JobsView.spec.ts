/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listJobs } from '@/api/jobs'
import { listAllChannels } from '@/api/notifications'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import type { JobItem } from '@/types/jobs'
import type { NotificationChannelItem } from '@/types/notifications'
import JobsView from '@/views/jobs/JobsView.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/api/jobs', () => ({
  deleteJob: vi.fn(),
  listJobs: vi.fn(),
  pauseJob: vi.fn(),
  resumeJob: vi.fn(),
  runJob: vi.fn(),
}))
vi.mock('@/api/notifications', () => ({ listAllChannels: vi.fn() }))

const listJobsMock = vi.mocked(listJobs)
const listAllChannelsMock = vi.mocked(listAllChannels)

const job = (ids: string[]): JobItem => ({
  id: 1,
  jobName: '任务 A',
  pluginInstallationId: 'installation-a',
  pluginId: 'plugin-a',
  pluginDisplayName: '插件 A',
  notificationChannelIds: ids,
  ownerUserId: 'user-1',
  ownerUsername: 'admin',
  ownerDepartmentId: 1,
  ownerDepartmentName: '总部',
  cronExpression: '0 0/5 * * * ?',
  misfirePolicy: 'DEFAULT',
  inputJson: '{}',
  timeoutMillis: 60_000,
  concurrent: false,
  jobStatus: 'ENABLED',
})

const channel: NotificationChannelItem = {
  channelId: 'channel-a',
  displayName: '渠道 A',
  channelType: 'WEBHOOK',
  enabled: true,
  ownerUserId: 'user-1',
  ownerUsername: 'admin',
  ownerDepartmentId: 1,
  ownerDepartmentName: '总部',
}

function user(permissions: string[]): CurrentUser {
  return {
    userId: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    departmentId: 1,
    departmentName: '总部',
    registerTime: '2026-08-02T00:00:00',
    roles: [],
    permissions,
  }
}

const SlotStub = defineComponent({ template: '<div><slot name="extra" /><slot /></div>' })
let currentJobRow: JobItem
const ColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_props, { slots }) {
    return () => h('section', slots.default?.({ row: currentJobRow }))
  },
})
const TooltipStub = defineComponent({
  name: 'ElTooltip',
  props: { content: { type: String, default: '' } },
  template: '<span data-testid="tooltip" :data-content="content"><slot /></span>',
})

function mountView(permissions: string[], row = job(['channel-a', 'channel-missing'])) {
  currentJobRow = row
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile(user(permissions))
  return mount(JobsView, {
    global: {
      plugins: [pinia],
      stubs: {
        ElButton: SlotStub,
        ElDialog: SlotStub,
        ElForm: SlotStub,
        ElFormItem: SlotStub,
        ElInputNumber: SlotStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElTableColumn: ColumnStub,
        ElTag: SlotStub,
        ElTooltip: TooltipStub,
        JsonEditor: SlotStub,
        OwnerSummary: SlotStub,
        PageContainer: SlotStub,
        PaginationTable: SlotStub,
        PermissionGuard: SlotStub,
        RouterLink: SlotStub,
      },
    },
  })
}

describe('JobsView notification-channel names', () => {
  beforeEach(() => {
    listJobsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
    listAllChannelsMock.mockResolvedValue([channel])
  })

  it('joins readable names, falls back to missing IDs, and exposes name/ID hover text', async () => {
    const wrapper = mountView(['job:read', 'notification:channel:read'])
    await flushPromises()

    expect(wrapper.text()).toContain('渠道 A、channel-missing')
    expect(
      wrapper
        .findAll('[data-testid="tooltip"]')
        .some((item) => item.attributes('data-content') === '渠道 A（channel-a）；channel-missing'),
    ).toBe(true)
  })

  it('does not request the directory without permission and displays IDs', async () => {
    const wrapper = mountView(['job:read'])
    await flushPromises()

    expect(listAllChannelsMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('channel-a、channel-missing')
  })

  it('renders a dash for jobs without notification channels', async () => {
    const wrapper = mountView(['job:read', 'notification:channel:read'], job([]))
    await flushPromises()

    expect(wrapper.find('.channel-list').text()).toBe('-')
  })
})
