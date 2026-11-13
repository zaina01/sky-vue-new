/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, inject, provide, ref, type PropType } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { ElMessage, ElMessageBox } from 'element-plus'
import Schema, { type Rules } from 'async-validator'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deletePluginServicePermission,
  getPluginServicePermission,
  listPluginServicePermissions,
  savePluginServicePermissionsBatch,
  setPluginServicePermissionEnabled,
} from '@/api/plugins'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { adminRoutes } from '@/router/routes'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import type { PluginServicePermissionItem } from '@/types/plugins'
import ServicePermissionsView from '@/views/plugins/ServicePermissionsView.vue'

vi.mock('@/api/plugins', () => ({
  deletePluginServicePermission: vi.fn(),
  getPluginServicePermission: vi.fn(),
  listPluginServicePermissions: vi.fn(),
  savePluginServicePermissionsBatch: vi.fn(),
  setPluginServicePermissionEnabled: vi.fn(),
}))

const deletePermissionMock = vi.mocked(deletePluginServicePermission)
const getPermissionMock = vi.mocked(getPluginServicePermission)
const listPermissionsMock = vi.mocked(listPluginServicePermissions)
const savePermissionMock = vi.mocked(savePluginServicePermissionsBatch)
const setPermissionEnabledMock = vi.mocked(setPluginServicePermissionEnabled)

const permission: PluginServicePermissionItem = {
  id: 2,
  callerInstallationId: 'task-installation-b',
  callerPluginId: 'frontend-integration',
  targetInstallationId: 'echo-service-installation',
  targetPluginId: 'frontend-integration-service',
  operation: 'echo',
  enabled: true,
  createdAt: '2026-08-02T18:25:09',
  updatedAt: '2026-08-02T18:25:09',
}

const tableRowsKey = Symbol('service-permission-rows')
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const PageContainerStub = defineComponent({
  template: '<main><slot name="extra" /><slot /></main>',
})
const ButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  emits: ['click'],
  template:
    '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})
const DialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean },
  emits: ['update:modelValue'],
  template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>',
})
// Run the actual page rules through Element Plus's validation engine. Its form
// component's externalized CommonJS dependency is not unwrapped in this Vitest setup.
const FormStub = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    rules: { type: Object as PropType<Rules>, default: () => ({}) },
  },
  setup(props, { expose, slots }) {
    const messages = ref<string[]>([])
    expose({
      async validate() {
        messages.value = []
        try {
          await new Schema(props.rules).validate(props.model)
          return true
        } catch (error) {
          const result = error as { errors: { message: string }[] }
          messages.value = result.errors.map((item) => item.message)
          return false
        }
      },
      clearValidate() {
        messages.value = []
      },
    })
    return () => h('form', [slots.default?.(), ...messages.value.map((message) => h('p', message))])
  },
})
const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: `<textarea v-if="type === 'textarea'" :value="modelValue" :placeholder="placeholder"
    @input="$emit('update:modelValue', $event.target.value)" />
    <input v-else :value="modelValue" :placeholder="placeholder" />`,
})
const InstallationSelectStub = defineComponent({
  name: 'PluginInstallationSelect',
  props: {
    modelValue: { type: String, default: '' },
    usage: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: '<span class="installation-select" :data-usage="usage">{{ modelValue }}</span>',
})
const PaginationTableStub = defineComponent({
  name: 'PaginationTable',
  props: {
    data: { type: Array as PropType<unknown[]>, default: () => [] },
    total: { type: Number, default: 0 },
  },
  setup(props, { slots }) {
    provide(tableRowsKey, () => props.data)
    return () => h('div', { 'data-total': props.total }, slots.default?.())
  },
})
const TableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_props, { slots }) {
    const rows = inject<() => unknown[]>(tableRowsKey, () => [])
    return () =>
      h(
        'div',
        rows().flatMap((row) => slots.default?.({ row }) || []),
      )
  },
})

function profile(permissions: string[]): CurrentUser {
  return {
    userId: 'admin',
    username: 'frontend_it_admin',
    email: 'admin@example.test',
    departmentId: 1,
    departmentName: '默认部门',
    registerTime: '2026-08-02T00:00:00',
    roles: ['ADMIN'],
    permissions,
  }
}

function mountView(
  permissions = [
    'plugin:service-permission:read',
    'plugin:service-permission:write',
    'plugin:runtime:read',
  ],
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile(profile(permissions))
  return mount(ServicePermissionsView, {
    global: {
      plugins: [pinia],
      stubs: {
        PageContainer: PageContainerStub,
        PaginationTable: PaginationTableStub,
        PluginDefinitionSelect: SlotStub,
        PluginInstallationSelect: InstallationSelectStub,
        ElAlert: defineComponent({
          name: 'ElAlert',
          props: { title: { type: String, default: '' } },
          template: '<div>{{ title }}</div>',
        }),
        ElButton: ButtonStub,
        ElDescriptions: SlotStub,
        ElDescriptionsItem: SlotStub,
        ElDialog: DialogStub,
        ElForm: FormStub,
        ElFormItem: SlotStub,
        ElInput: InputStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElSkeleton: SlotStub,
        ElSwitch: SlotStub,
        ElTableColumn: TableColumnStub,
        ElTag: SlotStub,
      },
    },
  })
}

function button(wrapper: ReturnType<typeof mountView>, label: string) {
  const result = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!result) throw new Error(`未找到按钮：${label}`)
  return result
}

describe('ServicePermissionsView', () => {
  beforeEach(() => {
    listPermissionsMock.mockReset()
    getPermissionMock.mockReset()
    savePermissionMock.mockReset()
    setPermissionEnabledMock.mockReset()
    deletePermissionMock.mockReset()
    listPermissionsMock.mockResolvedValue({
      items: [{ ...permission }],
      page: 1,
      size: 20,
      total: 37,
    })
    getPermissionMock.mockResolvedValue(permission)
    savePermissionMock.mockResolvedValue([permission])
    vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
    setPermissionEnabledMock.mockResolvedValue({ ...permission, enabled: false })
    deletePermissionMock.mockResolvedValue({ success: true })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
  })

  it('allows a TASK caller, filters the target to SERVICE, and uses backend total', async () => {
    const wrapper = mountView()
    await flushPromises()

    const selectors = wrapper.findAllComponents(InstallationSelectStub)
    expect(selectors).toHaveLength(2)
    expect(selectors[0]?.props('usage')).toBe('RUNTIME')
    expect(selectors[1]?.props('usage')).toBe('SERVICE')
    expect(wrapper.getComponent(PaginationTableStub).props('total')).toBe(37)

    await button(wrapper, '新增实例调用权限').trigger('click')
    expect(wrapper.text()).toContain('普通 TASK 实例不支持服务调用，不能作为目标')

    const dialogSelectors = wrapper.findAllComponents(InstallationSelectStub)
    expect(dialogSelectors[2]?.props('usage')).toBe('RUNTIME')
    expect(dialogSelectors[3]?.props('usage')).toBe('SERVICE')

    await button(wrapper, '详情').trigger('click')
    await flushPromises()
    expect(getPermissionMock).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('frontend-integration-service')
  })

  it('submits installation IDs, updates enabled state, deletes and rebuilds from real responses', async () => {
    const wrapper = mountView()
    await flushPromises()

    await button(wrapper, '禁用').trigger('click')
    await flushPromises()
    expect(setPermissionEnabledMock).toHaveBeenCalledWith(2, false)

    await button(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(deletePermissionMock).toHaveBeenCalledWith(2)

    await button(wrapper, '新增实例调用权限').trigger('click')
    const selectors = wrapper.findAllComponents(InstallationSelectStub)
    selectors[2]?.vm.$emit('update:modelValue', 'task-installation-b')
    selectors[3]?.vm.$emit('update:modelValue', 'echo-service-installation')
    const operationInput = wrapper
      .findAllComponents(InputStub)
      .find((item) => item.props('type') === 'textarea')
    operationInput?.vm.$emit('update:modelValue', 'echo')
    await wrapper.vm.$nextTick()
    await button(wrapper, '保存 1 项权限').trigger('click')
    await flushPromises()

    expect(savePermissionMock).toHaveBeenCalledWith({
      callerInstallationId: 'task-installation-b',
      targetInstallationId: 'echo-service-installation',
      operations: ['echo'],
      enabled: true,
    })
    expect(listPermissionsMock.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  async function createForm(text: string) {
    const wrapper = mountView()
    await flushPromises()
    await button(wrapper, '新增实例调用权限').trigger('click')
    const selectors = wrapper.findAllComponents(InstallationSelectStub)
    selectors[2]?.vm.$emit('update:modelValue', 'task-installation-b')
    selectors[3]?.vm.$emit('update:modelValue', 'echo-service-installation')
    await wrapper.get('textarea').setValue(text)
    return wrapper
  }

  it('trims multiline input, ignores blanks, deduplicates and refreshes after one request', async () => {
    const wrapper = await createForm(' first \r\nsecond\n\n first\nthird ')
    savePermissionMock.mockResolvedValue(
      ['first', 'second', 'third'].map((operation) => ({ ...permission, operation })),
    )
    expect(wrapper.text()).toContain('待保存 3 项权限')
    await button(wrapper, '保存 3 项权限').trigger('click')
    await flushPromises()
    expect(savePermissionMock).toHaveBeenCalledExactlyOnceWith({
      callerInstallationId: 'task-installation-b',
      targetInstallationId: 'echo-service-installation',
      operations: ['first', 'second', 'third'],
      enabled: true,
    })
    expect(ElMessage.success).toHaveBeenCalledWith('已保存 3 项安装实例服务调用权限')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(listPermissionsMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    [' \n ', '请至少输入一个 Operation'],
    ['valid\nbad/name', 'Operation「bad/name」无效'],
    ['*', 'Operation「*」无效'],
    ['a'.repeat(129), '长度 1-128'],
    [Array.from({ length: 101 }, (_, i) => `op${i}`).join('\n'), '每次最多保存 100 个'],
  ])('rejects invalid input %s without submitting', async (text, message) => {
    const wrapper = await createForm(text)
    await wrapper
      .findAll('button')
      .find((item) => item.text().startsWith('保存 '))!
      .trigger('click')
    await flushPromises()
    expect(savePermissionMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(message)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('accepts 100 distinct operations with a duplicate', async () => {
    const operations = Array.from({ length: 100 }, (_, i) => `op${i}`)
    const wrapper = await createForm([...operations, ' op0 '].join('\n'))
    await button(wrapper, '保存 100 项权限').trigger('click')
    await flushPromises()
    expect(savePermissionMock).toHaveBeenCalledWith(expect.objectContaining({ operations }))
  })

  it('retains input after failure, blocks duplicate submission and permits retry', async () => {
    const wrapper = await createForm(' first \nsecond')
    let rejectRequest!: (reason: Error) => void
    savePermissionMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    const saveButton = wrapper
      .findAllComponents(ButtonStub)
      .find((item) => item.text().trim() === '保存 2 项权限')!
    saveButton.vm.$emit('click')
    saveButton.vm.$emit('click')
    await flushPromises()
    expect(savePermissionMock).toHaveBeenCalledTimes(1)
    expect(saveButton.props('disabled')).toBe(true)
    expect(button(wrapper, '取消').attributes('disabled')).toBeDefined()
    rejectRequest(new Error('batch failed'))
    await flushPromises()
    expect(wrapper.get('textarea').element.value).toBe(' first \nsecond')
    expect(saveButton.props('disabled')).toBe(false)
    expect(listPermissionsMock).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).not.toHaveBeenCalled()
    await button(wrapper, '保存 2 项权限').trigger('click')
    await flushPromises()
    expect(savePermissionMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('hides writes without write permission and does not mount protected selectors', async () => {
    const wrapper = mountView(['plugin:service-permission:read'])
    await flushPromises()

    expect(wrapper.findAllComponents(PluginInstallationSelect)).toHaveLength(0)
    expect(wrapper.findAllComponents(InstallationSelectStub)).toHaveLength(0)
    const labels = wrapper.findAll('button').map((item) => item.text().trim())
    expect(labels).not.toContain('新增实例调用权限')
    expect(labels).not.toContain('禁用')
    expect(labels).not.toContain('删除')
    expect(wrapper.text()).toContain('详情')

    const pluginGroup = adminRoutes.find((route) => route.path === '/plugins')
    const route = pluginGroup?.children?.find((item) => item.path === 'service-permissions')
    expect(route?.meta?.permission).toBe('plugin:service-permission:read')
  })
})
