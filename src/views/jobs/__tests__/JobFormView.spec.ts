/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createJob, getJob, replaceJobNotificationChannels, updateJob } from '@/api/jobs'
import { listAllChannels } from '@/api/notifications'
import { getPluginInstallationNotificationChannels } from '@/api/plugins'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import type { JobItem } from '@/types/jobs'
import type { NotificationChannelItem } from '@/types/notifications'
import JobFormView from '@/views/jobs/JobFormView.vue'

const routerState = vi.hoisted(() => ({
  route: { name: 'job-edit', params: { id: '1' } },
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routerState.route,
  useRouter: () => ({ push: routerState.push }),
}))

vi.mock('@/api/jobs', () => ({
  createJob: vi.fn(),
  getJob: vi.fn(),
  replaceJobNotificationChannels: vi.fn(),
  updateJob: vi.fn(),
}))

vi.mock('@/api/notifications', () => ({
  listAllChannels: vi.fn(),
}))

vi.mock('@/api/plugins', () => ({
  getPluginInstallationNotificationChannels: vi.fn(),
}))

const createJobMock = vi.mocked(createJob)
const getJobMock = vi.mocked(getJob)
const replaceChannelsMock = vi.mocked(replaceJobNotificationChannels)
const updateJobMock = vi.mocked(updateJob)
const getPoolMock = vi.mocked(getPluginInstallationNotificationChannels)
const listAllChannelsMock = vi.mocked(listAllChannels)

const job: JobItem = {
  id: 1,
  jobName: '联调任务',
  pluginInstallationId: 'installation-a',
  pluginId: 'same-plugin',
  pluginDisplayName: '联调插件',
  notificationChannelIds: ['channel-a'],
  ownerUserId: 'admin-1',
  ownerUsername: 'admin',
  ownerDepartmentId: 1,
  ownerDepartmentName: '总部',
  cronExpression: '0 0/5 * * * ?',
  misfirePolicy: 'DO_NOTHING',
  inputJson: '{}',
  timeoutMillis: 60_000,
  concurrent: false,
  jobStatus: 'ENABLED',
  remark: '',
}

const allPermissions = ['job:write', 'job:notification:bind', 'notification:channel:read']
const notificationChannel = (channelId: string, displayName: string): NotificationChannelItem => ({
  channelId,
  displayName,
  channelType: 'WEBHOOK',
  enabled: true,
  ownerUserId: 'admin-1',
  ownerUsername: 'admin',
  ownerDepartmentId: 1,
  ownerDepartmentName: '总部',
})
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const PageContainerStub = defineComponent({
  template: '<main><slot name="extra" /><slot /></main>',
})
const ButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  template: '<button type="button" :disabled="disabled"><slot /></button>',
})
const FormStub = defineComponent({
  name: 'ElForm',
  setup(_props, { expose, slots }) {
    expose({
      clearValidate: () => undefined,
      validate: () => Promise.resolve(true),
      validateField: () => Promise.resolve(true),
    })
    return () => h('form', slots.default?.())
  },
})
const CronEditorStub = defineComponent({
  name: 'CronEditor',
  props: { modelValue: String },
  emits: ['update:modelValue', 'valid-change', 'validate-message-change'],
  template: '<div data-testid="cron-editor" />',
})
const InstallationSelectStub = defineComponent({
  name: 'PluginInstallationSelect',
  props: { modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  template: '<div data-testid="installation-select" />',
})
const SelectStub = defineComponent({
  name: 'ElSelect',
  props: { modelValue: { type: [Array, String, Number], default: undefined }, disabled: Boolean },
  emits: ['update:modelValue'],
  template: '<div data-testid="select"><slot /></div>',
})
const AlertStub = defineComponent({
  name: 'ElAlert',
  props: { title: String },
  template: '<div data-testid="alert">{{ title }}</div>',
})
const OptionStub = defineComponent({
  name: 'ElOption',
  props: { label: String, value: { type: [String, Number], default: undefined } },
  template: '<span data-testid="option" :data-value="value">{{ label }}</span>',
})

function currentUser(permissions = allPermissions): CurrentUser {
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
  return mount(JobFormView, {
    global: {
      plugins: [pinia],
      stubs: {
        CronEditor: CronEditorStub,
        JsonEditor: SlotStub,
        OwnerSummary: SlotStub,
        PageBackButton: SlotStub,
        PageContainer: PageContainerStub,
        PluginInstallationSelect: InstallationSelectStub,
        RouterLink: SlotStub,
        ElAlert: AlertStub,
        ElButton: ButtonStub,
        ElDescriptions: SlotStub,
        ElDescriptionsItem: SlotStub,
        ElDivider: SlotStub,
        ElForm: FormStub,
        ElFormItem: SlotStub,
        ElInput: SlotStub,
        ElInputNumber: SlotStub,
        ElOption: OptionStub,
        ElSelect: SelectStub,
        ElSkeleton: SlotStub,
        ElSwitch: SlotStub,
        ElTag: SlotStub,
      },
    },
  })
}

function findButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}

function channelSelect(wrapper: VueWrapper) {
  const select = wrapper
    .findAllComponents(SelectStub)
    .find((item) => Array.isArray(item.props('modelValue')))
  if (!select) throw new Error('未找到任务渠道选择器')
  return select
}

async function makeCronValid(wrapper: VueWrapper) {
  wrapper.getComponent(CronEditorStub).vm.$emit('valid-change', true)
  await wrapper.vm.$nextTick()
}

describe('JobFormView notification channel workflow', () => {
  beforeEach(() => {
    routerState.route.name = 'job-edit'
    routerState.route.params = { id: '1' }
    routerState.push.mockReset()
    createJobMock.mockReset()
    getJobMock.mockReset()
    replaceChannelsMock.mockReset()
    updateJobMock.mockReset()
    getPoolMock.mockReset()
    listAllChannelsMock.mockReset()
    getJobMock.mockResolvedValue(job)
    getPoolMock.mockImplementation((installationId) =>
      Promise.resolve(installationId === 'installation-a' ? ['channel-a'] : ['channel-b']),
    )
    listAllChannelsMock.mockResolvedValue([
      notificationChannel('channel-a', '渠道 A'),
      notificationChannel('channel-b', '渠道 B'),
    ])
    updateJobMock.mockResolvedValue({
      ...job,
      pluginInstallationId: 'installation-b',
      notificationChannelIds: [],
    })
    replaceChannelsMock.mockImplementation((_jobId, channelIds) =>
      Promise.resolve({
        ...job,
        pluginInstallationId: 'installation-b',
        notificationChannelIds: [...channelIds],
      }),
    )
    createJobMock.mockResolvedValue(job)
    vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('switches installations in clear, update, then rebind order without carrying old channels', async () => {
    const wrapper = mountView()
    await flushPromises()
    await makeCronValid(wrapper)

    wrapper.getComponent(InstallationSelectStub).vm.$emit('update:modelValue', 'installation-b')
    await flushPromises()
    expect(getPoolMock).toHaveBeenLastCalledWith('installation-b')
    expect(channelSelect(wrapper).props('modelValue')).toEqual([])
    channelSelect(wrapper).vm.$emit('update:modelValue', ['channel-b'])
    await wrapper.vm.$nextTick()
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)

    await findButton(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(replaceChannelsMock).toHaveBeenNthCalledWith(1, '1', [])
    expect(updateJobMock).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ pluginInstallationId: 'installation-b' }),
    )
    expect(replaceChannelsMock).toHaveBeenNthCalledWith(2, '1', ['channel-b'])
    expect(replaceChannelsMock.mock.invocationCallOrder[0]).toBeLessThan(
      updateJobMock.mock.invocationCallOrder[0]!,
    )
    expect(updateJobMock.mock.invocationCallOrder[0]).toBeLessThan(
      replaceChannelsMock.mock.invocationCallOrder[1]!,
    )
    expect(replaceChannelsMock.mock.calls.flatMap((call) => call[1])).not.toContain('channel-a')
  })

  it('submits selected instance-pool channels when creating a job', async () => {
    routerState.route.name = 'job-create'
    routerState.route.params = { id: '' }
    const wrapper = mountView()
    await flushPromises()
    await makeCronValid(wrapper)

    wrapper.getComponent(InstallationSelectStub).vm.$emit('update:modelValue', 'installation-b')
    await flushPromises()
    channelSelect(wrapper).vm.$emit('update:modelValue', ['channel-b'])
    await wrapper.vm.$nextTick()
    await findButton(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(createJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginInstallationId: 'installation-b',
        notificationChannelIds: ['channel-b'],
      }),
    )
  })

  it('shows channel names and appends IDs only for duplicate candidate names', async () => {
    getPoolMock.mockResolvedValue(['channel-a', 'channel-b'])
    listAllChannelsMock.mockResolvedValue([
      notificationChannel('channel-a', '同名渠道'),
      notificationChannel('channel-b', '同名渠道'),
    ])

    const wrapper = mountView()
    await flushPromises()

    const labels = wrapper
      .findAll('[data-testid="option"]')
      .filter((item) => ['channel-a', 'channel-b'].includes(item.attributes('data-value') || ''))
      .map((item) => item.text())
    expect(labels).toEqual(['同名渠道（channel-a）', '同名渠道（channel-b）'])
  })

  it('keeps ID-based channel editing available when the name directory fails', async () => {
    listAllChannelsMock.mockRejectedValue(new Error('directory failed'))

    const wrapper = mountView()
    await flushPromises()

    const channelOption = wrapper
      .findAll('[data-testid="option"]')
      .find((item) => item.attributes('data-value') === 'channel-a')
    expect(channelOption?.text()).toBe('channel-a')
    expect(channelSelect(wrapper).props('disabled')).toBe(false)
  })

  it('blocks a switch when the new instance pool read fails', async () => {
    getPoolMock.mockImplementation((installationId) =>
      installationId === 'installation-a'
        ? Promise.resolve(['channel-a'])
        : Promise.reject(new Error('pool read failed')),
    )
    const wrapper = mountView()
    await flushPromises()
    await makeCronValid(wrapper)

    wrapper.getComponent(InstallationSelectStub).vm.$emit('update:modelValue', 'installation-b')
    await flushPromises()
    expect(wrapper.text()).toContain('保持未知状态')
    await findButton(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(updateJobMock).not.toHaveBeenCalled()
    expect(replaceChannelsMock).not.toHaveBeenCalled()
  })

  it('requires all three job channel permissions before exposing an installation switch', async () => {
    const wrapper = mountView(allPermissions.slice(0, 2))
    await flushPromises()

    expect(wrapper.getComponent(InstallationSelectStub).props('disabled')).toBe(true)
    expect(wrapper.text()).toContain('已有任务的安装实例不可更换')
    expect(getPoolMock).not.toHaveBeenCalled()
    expect(listAllChannelsMock).not.toHaveBeenCalled()
  })
})
