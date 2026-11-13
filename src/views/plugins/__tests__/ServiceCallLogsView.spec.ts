/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, inject, provide, type PropType } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPluginServiceCall,
  getPluginServiceCallRunnerLog,
  listPluginServiceCalls,
} from '@/api/plugins'
import ServiceCallLogsView from '@/views/plugins/ServiceCallLogsView.vue'
import { useUserStore } from '@/stores/user'
import type { PluginServiceCallLog, PluginServiceCallRunnerLog } from '@/types/plugins'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/api/plugins', () => ({
  getPluginServiceCall: vi.fn(),
  getPluginServiceCallRunnerLog: vi.fn(),
  listPluginServiceCalls: vi.fn(),
}))

const getCallMock = vi.mocked(getPluginServiceCall)
const getRunnerLogMock = vi.mocked(getPluginServiceCallRunnerLog)
const listCallsMock = vi.mocked(listPluginServiceCalls)

const call: PluginServiceCallLog = {
  id: 9,
  jobId: 1,
  executionId: 73,
  callerInstallationId: 'task-installation-b',
  callerPluginId: 'frontend-integration',
  callerOwnerUserId: 'caller-user',
  callerOwnerDepartmentId: 2,
  callerInstanceId: 'task-runner-instance',
  callerRequestId: 'caller-request',
  targetInstallationId: 'echo-service-installation',
  targetPluginId: 'frontend-integration-service',
  targetOwnerUserId: 'service-user',
  targetOwnerDepartmentId: 1,
  targetInstanceId: 'service-runner-instance',
  operation: 'echo',
  serviceRequestId: 'service-request-9',
  targetRunnerLogPath: 'D:/runner.log',
  timeoutMillis: 10_000,
  durationMillis: 42,
  requestBytes: 38,
  responseBytes: 32,
  success: true,
  createdAt: '2026-08-02T18:25:27',
}

const runnerLog: PluginServiceCallRunnerLog = {
  serviceCallLogId: 9,
  targetInstallationId: 'echo-service-installation',
  targetPluginId: 'frontend-integration-service',
  targetInstanceId: 'service-runner-instance',
  runnerLogPath: 'D:/runner.log',
  exists: true,
  content: 'frontend integration service handled echo',
  offset: 4,
  nextOffset: 45,
  limitBytes: 65_536,
  sizeBytes: 45,
  eof: true,
  truncated: false,
}

const rowsKey = Symbol('service-call-rows')
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const ButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
})
const DialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean },
  template: '<section v-if="modelValue"><slot /></section>',
})
const InstallationSelectStub = defineComponent({
  name: 'PluginInstallationSelect',
  props: { usage: { type: String, default: '' }, modelValue: { type: String, default: '' } },
  template: '<span class="installation-select" :data-usage="usage" />',
})
const DefinitionSelectStub = defineComponent({
  name: 'PluginDefinitionSelect',
  template: '<span class="definition-select" />',
})
const PaginationTableStub = defineComponent({
  name: 'PaginationTable',
  props: {
    data: { type: Array as PropType<unknown[]>, default: () => [] },
    total: { type: Number, default: 0 },
  },
  setup(props, { slots }) {
    provide(rowsKey, () => props.data)
    return () => h('div', { 'data-total': props.total }, slots.default?.())
  },
})
const TableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_props, { slots }) {
    const rows = inject<() => unknown[]>(rowsKey, () => [])
    return () =>
      h(
        'div',
        rows().flatMap((row) => slots.default?.({ row }) || []),
      )
  },
})

function mountView(permissions = ['plugin:audit:read', 'plugin:runtime:read']) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile({
    userId: 'admin',
    username: 'frontend_it_admin',
    email: 'admin@example.test',
    departmentId: 1,
    departmentName: '默认部门',
    registerTime: '2026-08-02T00:00:00',
    roles: ['ADMIN'],
    permissions,
  })
  return mount(ServiceCallLogsView, {
    global: {
      plugins: [pinia],
      stubs: {
        PageContainer: defineComponent({ template: '<main><slot /></main>' }),
        OwnerSummary: SlotStub,
        PaginationTable: PaginationTableStub,
        PluginDefinitionSelect: DefinitionSelectStub,
        PluginInstallationSelect: InstallationSelectStub,
        ElButton: ButtonStub,
        ElCard: SlotStub,
        ElDescriptions: SlotStub,
        ElDescriptionsItem: SlotStub,
        ElDialog: DialogStub,
        ElEmpty: SlotStub,
        ElForm: SlotStub,
        ElFormItem: SlotStub,
        ElInput: SlotStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElSkeleton: SlotStub,
        ElTableColumn: TableColumnStub,
        ElTag: SlotStub,
      },
      directives: { loading: () => undefined },
    },
  })
}

function button(wrapper: ReturnType<typeof mountView>, label: string) {
  const result = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!result) throw new Error(`未找到按钮：${label}`)
  return result
}

describe('ServiceCallLogsView', () => {
  beforeEach(() => {
    listCallsMock.mockReset()
    getCallMock.mockReset()
    getRunnerLogMock.mockReset()
    listCallsMock.mockResolvedValue({ items: [call], page: 2, size: 20, total: 51 })
    getCallMock.mockResolvedValue(call)
    getRunnerLogMock.mockResolvedValue(runnerLog)
  })

  it('renders a non-empty backend page, detail, and real runner-log metadata', async () => {
    const wrapper = mountView()
    await flushPromises()

    const selectors = wrapper.findAllComponents(InstallationSelectStub)
    expect(selectors[0]?.props('usage')).toBe('RUNTIME')
    expect(selectors[1]?.props('usage')).toBe('SERVICE')
    expect(wrapper.getComponent(PaginationTableStub).props('total')).toBe(51)
    expect(wrapper.text()).toContain('成功')

    await button(wrapper, '详情').trigger('click')
    await flushPromises()
    expect(getCallMock).toHaveBeenCalledWith(9)
    expect(wrapper.text()).toContain('service-request-9')
    expect(wrapper.text()).toContain('32 B')

    await button(wrapper, '查看日志').trigger('click')
    await flushPromises()
    expect(getRunnerLogMock).toHaveBeenCalledWith(9, { tailBytes: 65_536 })
    expect(wrapper.text()).toContain('frontend integration service handled echo')
    expect(wrapper.text()).toContain('目标实例：echo-service-installation')
    expect(wrapper.text()).toContain('offset：4')
    expect(wrapper.text()).toContain('nextOffset：45')
    expect(wrapper.text()).toContain('limitBytes：65536')
    expect(wrapper.text()).toContain('已到末尾')
  })

  it('keeps the audit page usable without runtime catalog permission', async () => {
    const wrapper = mountView(['plugin:audit:read'])
    await flushPromises()

    expect(wrapper.findAllComponents(InstallationSelectStub)).toHaveLength(0)
    expect(wrapper.findAllComponents(DefinitionSelectStub)).toHaveLength(0)
    expect(listCallsMock).toHaveBeenCalled()
    expect(wrapper.getComponent(PaginationTableStub).props('total')).toBe(51)
  })
})
