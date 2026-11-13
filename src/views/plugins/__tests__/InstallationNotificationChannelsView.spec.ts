/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listAllChannels } from '@/api/notifications'
import {
  getPluginInstallationNotificationChannels,
  replacePluginInstallationNotificationChannels,
} from '@/api/plugins'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import type { NotificationChannelItem } from '@/types/notifications'
import type { PluginInstallationResponse } from '@/types/plugins'
import InstallationNotificationChannelsView from '@/views/plugins/InstallationNotificationChannelsView.vue'

vi.mock('@/api/notifications', () => ({
  listAllChannels: vi.fn(),
}))

vi.mock('@/api/plugins', () => ({
  getPluginInstallationNotificationChannels: vi.fn(),
  replacePluginInstallationNotificationChannels: vi.fn(),
}))

const listAllChannelsMock = vi.mocked(listAllChannels)
const getPoolMock = vi.mocked(getPluginInstallationNotificationChannels)
const replacePoolMock = vi.mocked(replacePluginInstallationNotificationChannels)

const allPermissions = [
  'plugin:runtime:manage',
  'plugin:notification-channel:bind',
  'notification:channel:read',
]
const installation = {
  installationId: 'installation-a',
  installationName: '实例 A',
} as PluginInstallationResponse
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const AlertStub = defineComponent({
  name: 'ElAlert',
  props: { title: String },
  template: '<div data-testid="alert">{{ title }}</div>',
})
const ButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  template: '<button type="button" :disabled="disabled"><slot /></button>',
})
const DialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
})
const SelectStub = defineComponent({
  name: 'ElSelect',
  props: { modelValue: { type: Array, default: undefined }, disabled: Boolean },
  emits: ['update:modelValue'],
  template: '<div data-testid="channel-select"><slot /></div>',
})
const TooltipStub = defineComponent({
  name: 'ElTooltip',
  props: { content: String },
  template: '<span data-testid="tooltip" :data-content="content"><slot /></span>',
})

function currentUser(permissions: string[]): CurrentUser {
  return {
    userId: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    departmentId: 1,
    departmentName: '总部',
    registerTime: '2026-08-02T00:00:00',
    roles: ['ADMIN'],
    permissions,
  }
}

function mountView(permissions = allPermissions) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile(currentUser(permissions))
  return mount(InstallationNotificationChannelsView, {
    props: { installation },
    global: {
      plugins: [pinia],
      stubs: {
        ElAlert: AlertStub,
        ElButton: ButtonStub,
        ElCard: defineComponent({
          template: '<article><slot name="header" /><slot /></article>',
        }),
        ElDialog: DialogStub,
        ElForm: SlotStub,
        ElFormItem: SlotStub,
        ElOption: SlotStub,
        ElSelect: SelectStub,
        ElTag: SlotStub,
        ElTooltip: TooltipStub,
      },
    },
  })
}

function findButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}

describe('InstallationNotificationChannelsView known pool state', () => {
  beforeEach(() => {
    getPoolMock.mockReset()
    replacePoolMock.mockReset()
    listAllChannelsMock.mockReset()
    listAllChannelsMock.mockResolvedValue([channel])
    replacePoolMock.mockResolvedValue([])
    vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps editing disabled until GET succeeds and permits an explicit clear afterwards', async () => {
    const pending = deferred<string[]>()
    getPoolMock.mockReturnValue(pending.promise)
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    expect(findButton(wrapper, '编辑实例渠道池').attributes('disabled')).toBeDefined()
    expect(replacePoolMock).not.toHaveBeenCalled()

    pending.resolve(['channel-a'])
    await flushPromises()
    expect(getPoolMock).toHaveBeenCalledWith('installation-a')
    expect(findButton(wrapper, '编辑实例渠道池').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('渠道 A')
    expect(wrapper.get('[data-testid="tooltip"]').attributes('data-content')).toBe(
      '渠道 A（channel-a）',
    )

    await findButton(wrapper, '编辑实例渠道池').trigger('click')
    wrapper.getComponent(SelectStub).vm.$emit('update:modelValue', [])
    await wrapper.vm.$nextTick()
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    await findButton(wrapper, '保存渠道池').trigger('click')
    await flushPromises()

    expect(replacePoolMock).toHaveBeenCalledWith('installation-a', [])
  })

  it('keeps a failed read unknown and never submits PUT', async () => {
    getPoolMock.mockRejectedValue(new Error('read failed'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('当前绑定保持未知状态')
    expect(findButton(wrapper, '编辑实例渠道池').attributes('disabled')).toBeDefined()
    expect(replacePoolMock).not.toHaveBeenCalled()
  })

  it('keeps the pool usable and falls back to the ID when the name directory fails', async () => {
    getPoolMock.mockResolvedValue(['channel-missing'])
    listAllChannelsMock.mockRejectedValue(new Error('directory failed'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('channel-missing')
    expect(wrapper.get('[data-testid="tooltip"]').attributes('data-content')).toBe(
      'channel-missing',
    )
    expect(findButton(wrapper, '编辑实例渠道池').attributes('disabled')).toBeUndefined()
  })

  it('does not read or render the edit operation when one permission is missing', async () => {
    const wrapper = mountView(allPermissions.slice(0, 2))
    await flushPromises()

    expect(wrapper.text()).toContain('不能读取或编辑实例渠道池')
    expect(getPoolMock).not.toHaveBeenCalled()
    expect(listAllChannelsMock).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').some((item) => item.text().includes('编辑实例渠道池'))).toBe(
      false,
    )
  })
})
