/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, inject, nextTick, provide, type PropType } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchDeletePluginAccounts,
  batchUpdatePluginAccountsGroup,
  updatePluginAccountGroup,
  listPluginAccountGroups,
  exportPluginAccounts,
  importPluginAccounts,
  createPluginAccount,
  deletePluginAccount,
  getPluginAccount,
  getPluginAccountSchema,
  getPluginAccountViewPreference,
  listPluginAccounts,
  updatePluginAccount,
  updatePluginAccountViewPreference,
} from '@/api/plugins'
import { useUserStore } from '@/stores/user'
import AccountsView from '@/views/plugins/AccountsView.vue'
import PluginAccountGroupManager from '@/components/plugins/PluginAccountGroupManager.vue'
import type {
  PluginAccountListItem,
  PluginAccountListField,
  PluginAccountSchemaResponse,
  PluginAccountViewPreference,
} from '@/types/plugins'
import type { PageResponse } from '@/types/common'

vi.mock('@/api/plugins', () => ({
  batchUpdatePluginAccountsGroup: vi.fn(),
  updatePluginAccountGroup: vi.fn(),
  listPluginAccountGroups: vi.fn(),
  batchDeletePluginAccounts: vi.fn(),
  batchUpdatePluginAccountsEnabled: vi.fn(),
  createPluginAccount: vi.fn(),
  deletePluginAccount: vi.fn(),
  exportPluginAccounts: vi.fn(),
  getPluginAccount: vi.fn(),
  getPluginAccountSchema: vi.fn(),
  getPluginAccountViewPreference: vi.fn(),
  importPluginAccounts: vi.fn(),
  listPluginAccounts: vi.fn(),
  setPluginAccountEnabled: vi.fn(),
  updatePluginAccount: vi.fn(),
  updatePluginAccountViewPreference: vi.fn(),
}))

const listPluginAccountsMock = vi.mocked(listPluginAccounts)
const batchDeletePluginAccountsMock = vi.mocked(batchDeletePluginAccounts)
const createPluginAccountMock = vi.mocked(createPluginAccount)
const deletePluginAccountMock = vi.mocked(deletePluginAccount)
const getPluginAccountSchemaMock = vi.mocked(getPluginAccountSchema)
const getPluginAccountViewPreferenceMock = vi.mocked(getPluginAccountViewPreference)
const getPluginAccountMock = vi.mocked(getPluginAccount)
const updatePluginAccountMock = vi.mocked(updatePluginAccount)
const updatePluginAccountViewPreferenceMock = vi.mocked(updatePluginAccountViewPreference)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const tableRowKey = Symbol('account-table-row')
const paginationTableMountSpy = vi.fn()
const clearSelectionSpy = vi.fn()
const toggleRowSelectionSpy = vi.fn()
const formValidateSpy = vi.fn(() => Promise.resolve(true))
const PaginationTableStub = defineComponent({
  name: 'PaginationTable',
  props: { data: { type: Array, default: () => [] } },
  emits: ['header-dragend', 'page-change', 'selection-change', 'size-change'],
  setup(props, { expose }) {
    paginationTableMountSpy()
    expose({ clearSelection: clearSelectionSpy, toggleRowSelection: toggleRowSelectionSpy })
    provide(
      tableRowKey,
      computed(() => (props.data[0] as Record<string, unknown> | undefined) || {}),
    )
  },
  template:
    '<div><pre data-testid="account-rows">{{ JSON.stringify(data) }}</pre><div class="columns"><slot /></div></div>',
})
const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  props: {
    type: { type: String, default: '' },
    label: { type: String, default: '' },
    prop: { type: String, default: '' },
    columnKey: { type: String, default: '' },
    width: { type: Number, default: undefined },
    minWidth: { type: [String, Number], default: undefined },
    resizable: { type: Boolean, default: true },
    showOverflowTooltip: { type: Boolean, default: false },
  },
  setup() {
    return {
      row: inject(
        tableRowKey,
        computed(() => ({})),
      ),
    }
  },
  template:
    '<section class="table-column" :data-label="label || prop"><slot :row="row" /></section>',
})
const PermissionGuardStub = defineComponent({
  name: 'PermissionGuard',
  template: '<div><slot /></div>',
})
const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  template: '<button type="button" :disabled="disabled || loading"><slot /></button>',
})
const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    title: { type: String, default: '' },
    modelValue: Boolean,
  },
  emits: ['update:modelValue', 'closed'],
  template:
    '<section class="dialog" :data-title="title"><template v-if="modelValue"><slot /><footer><slot name="footer" /></footer></template></section>',
})
const ElFormStub = defineComponent({
  name: 'ElForm',
  methods: {
    clearValidate() {},
    validate() {
      return formValidateSpy()
    },
  },
  template: '<form><slot /></form>',
})
const SlotStub = defineComponent({ template: '<div><slot /></div>' })

function pluginSchemaFormStub(nextValue: Record<string, unknown>) {
  return defineComponent({
    name: 'PluginSchemaForm',
    props: { modelValue: { type: Object, default: () => ({}) } },
    emits: ['update:modelValue', 'valid-change'],
    setup(_props, { emit }) {
      return {
        applyRecursiveValue() {
          emit('update:modelValue', nextValue)
          emit('valid-change', true)
        },
      }
    },
    template:
      '<button data-testid="apply-recursive-account" @click="applyRecursiveValue">应用递归账户值</button>',
  })
}
const PluginAccountColumnSettingsStub = defineComponent({
  name: 'PluginAccountColumnSettings',
  props: {
    modelValue: { type: Array as PropType<string[]>, default: () => [] },
    availableFields: { type: Array as PropType<PluginAccountListField[]>, default: () => [] },
    maxFields: { type: Number, default: 5 },
  },
  emits: ['update:modelValue'],
  template: '<div data-testid="column-settings" />',
})
const PluginAccountListCellStub = defineComponent({
  name: 'PluginAccountListCell',
  props: {
    field: { type: Object as PropType<PluginAccountListField>, required: true },
    value: { type: null as unknown as PropType<unknown>, default: undefined },
  },
  template: '<span class="dynamic-cell" :data-field="field.name">{{ value }}</span>',
})

const listFields = [
  { name: 'username', label: '用户名', type: 'TEXT' as const, options: [] },
  { name: 'region', label: '区域', type: 'SELECT' as const, options: ['华东', '华南'] },
]

function preference(
  installationId = 'installation-a',
  fields: string[] = [],
): PluginAccountViewPreference {
  return { installationId, fields, availableFields: listFields, maxFields: 5 }
}

function listItem(installationId = 'installation-a'): PluginAccountListItem {
  return {
    installationId,
    accountId: `account-${installationId.at(-1)}`,
    displayName: '测试账户',
    enabled: true,
    createdAt: '2026-08-12T09:00:00',
    updatedAt: '2026-08-12T10:00:00',
    groupId: null,
    groupName: null,
    displayValues: { username: '张三', region: '华东' },
  }
}

function accountItem(accountId: string): PluginAccountListItem {
  return { ...listItem(), accountId, displayName: accountId }
}

function defaultSchema(installationId = 'installation-a'): PluginAccountSchemaResponse {
  return {
    installationId,
    pluginId: 'demo.plugin',
    schemaJson: { fields: [{ name: 'username', label: '用户名', type: 'TEXT' }] },
  }
}

function mountAccounts(
  options: {
    actualPermissionGuard?: boolean
    actualForm?: boolean
    permissions?: string[]
    stubs?: Record<string, boolean | object>
  } = {},
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile({
    userId: 'user-1',
    username: 'tester',
    email: 'tester@example.test',
    departmentId: null,
    departmentName: null,
    registerTime: '2026-08-12T08:00:00',
    roles: [],
    permissions: options.permissions || ['plugin:account:read', 'plugin:account:write'],
  })

  const stubs = {
    PaginationTable: PaginationTableStub,
    ElTableColumn: ElTableColumnStub,
    ElButton: ElButtonStub,
    ElDialog: ElDialogStub,
    PluginAccountColumnSettings: PluginAccountColumnSettingsStub,
    PluginAccountListCell: PluginAccountListCellStub,
    PluginAccountGroupManager: true,
    ElTable: true,
    JsonEditor: true,
    PluginSchemaForm: true,
    ElAlert: SlotStub,
    ElCheckbox: true,
    ElDescriptions: true,
    ElDescriptionsItem: true,
    ElForm: ElFormStub,
    ElFormItem: SlotStub,
    ElInput: true,
    ElOption: true,
    ElRadioButton: true,
    ElRadioGroup: true,
    ElSelect: defineComponent({
      name: 'ElSelect',
      props: {
        modelValue: { type: [String, Number, Boolean], default: undefined },
        disabled: Boolean,
      },
      emits: ['update:modelValue'],
      template: '<div><slot /></div>',
    }),
    ElSkeleton: true,
    ElSwitch: true,
    ElTabPane: true,
    ElTabs: true,
    ElTag: true,
    ElUpload: true,
  } as Record<string, boolean | object>
  if (!options.actualPermissionGuard) stubs.PermissionGuard = PermissionGuardStub
  Object.assign(stubs, options.stubs)
  if (options.actualForm) delete stubs.ElForm

  return mount(AccountsView, {
    props: { installationId: 'installation-a' },
    global: { plugins: options.actualForm ? [pinia, ElementPlus] : [pinia], stubs },
  })
}

function buttonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text().trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

async function invokeButtonHandler(wrapper: VueWrapper, text: string) {
  const button = wrapper
    .findAllComponents(ElButtonStub)
    .find((candidate) => candidate.text().trim() === text)
  if (!button) throw new Error(`Button component not found: ${text}`)
  const handler = button.vm.$.vnode.props?.onClick as (() => unknown) | undefined
  if (!handler) throw new Error(`Button click handler not found: ${text}`)
  await handler()
}

function columnDialog(wrapper: VueWrapper) {
  const dialog = wrapper
    .findAllComponents(ElDialogStub)
    .find((candidate) => candidate.props('title') === '账户列表列设置')
  if (!dialog) throw new Error('Column settings dialog not found')
  return dialog
}

function tableColumnByLabel(wrapper: VueWrapper, label: string) {
  const column = wrapper
    .findAllComponents(ElTableColumnStub)
    .find((candidate) => candidate.props('label') === label)
  if (!column) throw new Error(`Table column not found: ${label}`)
  return column
}

function selectionColumn(wrapper: VueWrapper) {
  const column = wrapper
    .findAllComponents(ElTableColumnStub)
    .find((candidate) => candidate.props('type') === 'selection')
  if (!column) throw new Error('Selection column not found')
  return column
}

beforeEach(() => {
  vi.mocked(listPluginAccountGroups).mockReset().mockResolvedValue([])
  vi.mocked(batchUpdatePluginAccountsGroup).mockReset()
  vi.mocked(updatePluginAccountGroup).mockReset()
  vi.mocked(exportPluginAccounts).mockReset()
  vi.mocked(importPluginAccounts).mockReset()
  localStorage.clear()
  paginationTableMountSpy.mockClear()
  clearSelectionSpy.mockClear()
  toggleRowSelectionSpy.mockClear()
  formValidateSpy.mockClear()
  batchDeletePluginAccountsMock.mockReset()
  createPluginAccountMock.mockReset()
  deletePluginAccountMock.mockReset()
  getPluginAccountSchemaMock.mockReset()
  getPluginAccountViewPreferenceMock.mockReset()
  listPluginAccountsMock.mockReset()
  getPluginAccountMock.mockReset()
  updatePluginAccountMock.mockReset()
  updatePluginAccountViewPreferenceMock.mockReset()

  getPluginAccountSchemaMock.mockResolvedValue(defaultSchema())
  getPluginAccountViewPreferenceMock.mockResolvedValue(preference())
  listPluginAccountsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
  updatePluginAccountViewPreferenceMock.mockResolvedValue(preference())
})

describe('AccountsView installation isolation', () => {
  it('commits list and schema only after the matching installation request wins', async () => {
    const listA = deferred<PageResponse<PluginAccountListItem>>()
    const listB = deferred<PageResponse<PluginAccountListItem>>()
    const schemaA = deferred<PluginAccountSchemaResponse>()
    const schemaB = deferred<PluginAccountSchemaResponse>()
    const preferenceA = deferred<PluginAccountViewPreference>()
    const preferenceB = deferred<PluginAccountViewPreference>()
    listPluginAccountsMock.mockImplementation((installationId) =>
      installationId === 'installation-a' ? listA.promise : listB.promise,
    )
    getPluginAccountSchemaMock.mockImplementation((installationId) =>
      installationId === 'installation-a' ? schemaA.promise : schemaB.promise,
    )
    getPluginAccountViewPreferenceMock.mockImplementation((installationId) =>
      installationId === 'installation-a' ? preferenceA.promise : preferenceB.promise,
    )

    const wrapper = mountAccounts()

    await wrapper.setProps({ installationId: 'installation-b' })
    preferenceB.resolve({
      installationId: 'installation-b',
      fields: [],
      availableFields: [],
      maxFields: 5,
    })
    schemaB.resolve({
      installationId: 'installation-b',
      pluginId: 'same.plugin',
      schemaJson: { fields: [{ name: 'bField', label: 'B', type: 'TEXT' }] },
    })
    await flushPromises()
    listB.resolve({
      items: [
        {
          accountId: 'account-b',
          installationId: 'installation-b',
          displayName: 'B',
          enabled: true,
          createdAt: '2026-08-12T09:00:00',
          updatedAt: '2026-08-12T10:00:00',
          groupId: null,
          groupName: null,
          displayValues: {},
        },
      ],
      page: 1,
      size: 10,
      total: 1,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="account-rows"]').text()).toContain('account-b')

    preferenceA.resolve({
      installationId: 'installation-a',
      fields: [],
      availableFields: [],
      maxFields: 5,
    })
    schemaA.resolve({
      installationId: 'installation-a',
      pluginId: 'same.plugin',
      schemaJson: { fields: [{ name: 'aField', label: 'A', type: 'TEXT' }] },
    })
    await flushPromises()
    listA.resolve({
      items: [
        {
          accountId: 'account-a',
          installationId: 'installation-a',
          displayName: 'A',
          enabled: true,
          createdAt: '2026-08-12T09:00:00',
          updatedAt: '2026-08-12T10:00:00',
          groupId: null,
          groupName: null,
          displayValues: {},
        },
      ],
      page: 1,
      size: 10,
      total: 99,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="account-rows"]').text()).toContain('account-b')
    expect(wrapper.get('[data-testid="account-rows"]').text()).not.toContain('account-a')
  })
})

describe('AccountsView custom columns', () => {
  it('waits for preference metadata, then renders dynamic columns in fields order', async () => {
    const pendingPreference = deferred<PluginAccountViewPreference>()
    const pendingList = deferred<PageResponse<PluginAccountListItem>>()
    getPluginAccountViewPreferenceMock.mockReturnValue(pendingPreference.promise)
    listPluginAccountsMock.mockReturnValue(pendingList.promise)

    const wrapper = mountAccounts()
    await flushPromises()
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(PaginationTableStub).exists()).toBe(false)
    expect(paginationTableMountSpy).not.toHaveBeenCalled()

    pendingPreference.resolve(preference('installation-a', ['region', 'username']))
    await flushPromises()
    expect(wrapper.findComponent(PaginationTableStub).exists()).toBe(false)

    pendingList.resolve({
      items: [listItem()],
      page: 1,
      size: 10,
      total: 1,
    })
    await flushPromises()

    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(paginationTableMountSpy).toHaveBeenCalledTimes(1)
    const labels = wrapper.findAll('.table-column').map((column) => column.attributes('data-label'))
    expect(labels).toEqual([
      '',
      '账户 ID',
      '显示名称',
      '状态',
      '分组',
      '创建时间',
      '更新时间',
      '区域',
      '用户名',
      '操作',
    ])
    expect(wrapper.findAll('.dynamic-cell').map((cell) => cell.text())).toEqual(['华东', '张三'])
    expect(wrapper.get('[data-testid="account-rows"]').text()).not.toContain('accountJson')
  })

  it('waits for the final column preference before mounting on every page entry', async () => {
    const firstPreference = deferred<PluginAccountViewPreference>()
    const secondPreference = deferred<PluginAccountViewPreference>()
    getPluginAccountViewPreferenceMock
      .mockReturnValueOnce(firstPreference.promise)
      .mockReturnValueOnce(secondPreference.promise)

    const firstWrapper = mountAccounts()
    await flushPromises()
    expect(firstWrapper.findComponent(PaginationTableStub).exists()).toBe(false)

    firstPreference.resolve(preference('installation-a', ['username', 'region']))
    await flushPromises()
    expect(firstWrapper.findComponent(PaginationTableStub).exists()).toBe(true)
    expect(paginationTableMountSpy).toHaveBeenCalledTimes(1)
    firstWrapper.unmount()

    const secondWrapper = mountAccounts()
    await flushPromises()
    expect(secondWrapper.findComponent(PaginationTableStub).exists()).toBe(false)
    expect(paginationTableMountSpy).toHaveBeenCalledTimes(1)

    secondPreference.resolve(preference('installation-a', ['username', 'region']))
    await flushPromises()
    expect(secondWrapper.findComponent(PaginationTableStub).exists()).toBe(true)
    expect(paginationTableMountSpy).toHaveBeenCalledTimes(2)
    expect(tableColumnByLabel(secondWrapper, '用户名').props('width')).toBeUndefined()
    expect(tableColumnByLabel(secondWrapper, '区域').props('width')).toBeUndefined()
  })

  it('renders only fixed columns when fields is empty', async () => {
    getPluginAccountViewPreferenceMock.mockResolvedValue(preference('installation-a', []))
    const wrapper = mountAccounts()
    await flushPromises()

    expect(wrapper.findAll('.dynamic-cell')).toHaveLength(0)
    expect(
      wrapper.findAll('.table-column').map((column) => column.attributes('data-label')),
    ).toEqual(['', '账户 ID', '显示名称', '状态', '分组', '创建时间', '更新时间', '操作'])
  })

  it('keeps up to five unmodified custom columns flexible with compact minimum widths', async () => {
    const fiveFields: PluginAccountListField[] = Array.from({ length: 5 }, (_, index) => ({
      name: `field${index + 1}`,
      label: `字段 ${index + 1}`,
      type: 'TEXT',
      options: [],
    }))
    getPluginAccountViewPreferenceMock.mockResolvedValue({
      installationId: 'installation-a',
      fields: fiveFields.map((field) => field.name),
      availableFields: fiveFields,
      maxFields: 5,
    })
    const wrapper = mountAccounts()
    await flushPromises()

    const selection = selectionColumn(wrapper)
    expect(selection.props('width')).toBeUndefined()
    expect(Number(selection.props('minWidth'))).toBe(48)
    expect(selection.props('resizable')).toBe(false)

    const expectedMinimumWidths: Record<string, number> = {
      '账户 ID': 90,
      显示名称: 80,
      状态: 90,
      创建时间: 80,
      更新时间: 80,
      操作: 180,
    }
    for (const [label, minWidth] of Object.entries(expectedMinimumWidths)) {
      const column = tableColumnByLabel(wrapper, label)
      expect(column.props('width')).toBeUndefined()
      expect(Number(column.props('minWidth'))).toBe(minWidth)
      expect(column.props('resizable')).toBe(true)
    }
    for (const label of ['显示名称', '创建时间', '更新时间']) {
      const column = tableColumnByLabel(wrapper, label)
      expect(column.props('showOverflowTooltip')).toBe(true)
    }
    for (const field of fiveFields) {
      const column = tableColumnByLabel(wrapper, field.label)
      expect(column.props('width')).toBeUndefined()
      expect(Number(column.props('minWidth'))).toBe(50)
      expect(column.props('resizable')).toBe(true)
      expect(column.props('showOverflowTooltip')).toBe(true)
    }
    const minimumTableWidth = wrapper
      .findAllComponents(ElTableColumnStub)
      .reduce((total, column) => {
        return total + Number(column.props('width') ?? column.props('minWidth') ?? 80)
      }, 0)
    expect(minimumTableWidth).toBe(998)
    expect(minimumTableWidth).toBeLessThan(1036)
  })

  it('ignores legacy manual width storage on every page entry', async () => {
    const legacyStorageKey = 'plugin-account-column-widths:v1:installation-a'
    const legacyWidths = JSON.stringify({ 'fixed:accountId': 240, 'field:username': 276 })
    localStorage.setItem(legacyStorageKey, legacyWidths)
    getPluginAccountViewPreferenceMock.mockResolvedValue(preference('installation-a', ['username']))

    const wrapper = mountAccounts()
    await flushPromises()

    expect(localStorage.getItem(legacyStorageKey)).toBe(legacyWidths)
    expect(tableColumnByLabel(wrapper, '用户名').props('width')).toBeUndefined()
    expect(tableColumnByLabel(wrapper, '账户 ID').props('width')).toBeUndefined()
    expect(tableColumnByLabel(wrapper, '用户名').props('resizable')).toBe(true)

    wrapper
      .getComponent(PaginationTableStub)
      .vm.$emit('header-dragend', 276, 160, { columnKey: 'field:username' })
    await nextTick()
    expect(localStorage.getItem(legacyStorageKey)).toBe(legacyWidths)
    wrapper.unmount()

    const reenteredWrapper = mountAccounts()
    await flushPromises()

    expect(tableColumnByLabel(reenteredWrapper, '用户名').props('width')).toBeUndefined()
    expect(tableColumnByLabel(reenteredWrapper, '账户 ID').props('width')).toBeUndefined()
  })

  it('keeps the current table instance across refresh and pagination', async () => {
    getPluginAccountViewPreferenceMock.mockResolvedValue(preference('installation-a', ['username']))
    const wrapper = mountAccounts()
    await flushPromises()
    const table = wrapper.getComponent(PaginationTableStub)
    const tableInstance = table.vm

    await buttonByText(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent(PaginationTableStub).vm).toBe(tableInstance)

    table.vm.$emit('page-change', 2)
    await flushPromises()
    expect(wrapper.getComponent(PaginationTableStub).vm).toBe(tableInstance)
  })

  it('submits restored defaults as an empty array and reloads the projected list', async () => {
    getPluginAccountViewPreferenceMock.mockResolvedValue(
      preference('installation-a', ['username', 'region']),
    )
    updatePluginAccountViewPreferenceMock.mockResolvedValue(preference('installation-a', []))
    const wrapper = mountAccounts()
    await flushPromises()
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    const tableBeforeSave = wrapper.getComponent(PaginationTableStub).vm

    await buttonByText(wrapper, '列设置').trigger('click')
    await buttonByText(columnDialog(wrapper), '恢复默认').trigger('click')
    await buttonByText(columnDialog(wrapper), '保存').trigger('click')
    await flushPromises()

    expect(updatePluginAccountViewPreferenceMock).toHaveBeenCalledWith('installation-a', {
      fields: [],
    })
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(2)
    expect(tableColumnByLabel(wrapper, '账户 ID').props('width')).toBeUndefined()
    expect(wrapper.getComponent(PaginationTableStub).vm).not.toBe(tableBeforeSave)
  })

  it('uses the current drag order as the PUT fields array', async () => {
    getPluginAccountViewPreferenceMock.mockResolvedValue(
      preference('installation-a', ['username', 'region']),
    )
    updatePluginAccountViewPreferenceMock.mockResolvedValue(
      preference('installation-a', ['region', 'username']),
    )
    const wrapper = mountAccounts()
    await flushPromises()
    const tableBeforeSave = wrapper.getComponent(PaginationTableStub).vm

    await buttonByText(wrapper, '列设置').trigger('click')
    const settings = wrapper.getComponent(PluginAccountColumnSettingsStub)
    settings.vm.$emit('update:modelValue', ['region', 'username'])
    await nextTick()
    await buttonByText(columnDialog(wrapper), '保存').trigger('click')
    await flushPromises()

    expect(updatePluginAccountViewPreferenceMock).toHaveBeenCalledWith('installation-a', {
      fields: ['region', 'username'],
    })
    expect(tableColumnByLabel(wrapper, '用户名').props('width')).toBeUndefined()
    expect(wrapper.getComponent(PaginationTableStub).vm).not.toBe(tableBeforeSave)
  })

  it('loads the detail DTO before editing a list item', async () => {
    listPluginAccountsMock.mockResolvedValue({
      items: [listItem()],
      page: 1,
      size: 10,
      total: 1,
    })
    getPluginAccountMock.mockResolvedValue({
      groupId: null,
      groupName: null,
      installationId: 'installation-a',
      accountId: 'account-a',
      displayName: '详情名称',
      enabled: true,
      accountJson: '{"username":"detail-user"}',
    })
    const wrapper = mountAccounts()
    await flushPromises()

    await buttonByText(wrapper, '编辑').trigger('click')
    await flushPromises()

    expect(getPluginAccountMock).toHaveBeenCalledWith('installation-a', 'account-a')
  })

  it('hides column settings without plugin:account:read permission', async () => {
    const wrapper = mountAccounts({ actualPermissionGuard: true, permissions: [] })
    await flushPromises()

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '列设置')).toBe(
      false,
    )
  })
})

describe('AccountsView recursive schema save', () => {
  const recursiveSchema: PluginAccountSchemaResponse = {
    installationId: 'installation-a',
    pluginId: 'demo.plugin',
    schemaJson: {
      accountIdField: 'accountKey',
      fields: [
        { name: 'accountKey', label: '账号键', type: 'TEXT', accountId: true },
        {
          name: 'profiles',
          label: '资料列表',
          type: 'OBJECT_LIST',
          itemSchema: {
            fields: [
              { name: 'name', label: '名称', type: 'TEXT' },
              { name: 'externalId', label: '外部 ID', type: 'TEXT', readonly: true },
              { name: 'secret', label: '密钥', type: 'PASSWORD', sensitive: true },
              {
                name: 'tokens',
                label: '令牌列表',
                type: 'OBJECT_LIST',
                itemSchema: {
                  fields: [
                    { name: 'tokenName', label: '令牌名', type: 'TEXT' },
                    { name: 'token', label: '令牌', type: 'PASSWORD', sensitive: true },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  }

  it('renders basic information and schema fields in separate, unnested forms', async () => {
    getPluginAccountSchemaMock.mockResolvedValue(recursiveSchema)
    const wrapper = mountAccounts({
      actualForm: true,
      stubs: {
        PluginSchemaForm: false,
        ElFormItem: false,
        ElTabs: SlotStub,
        ElTabPane: SlotStub,
      },
    })
    await flushPromises()
    await buttonByText(wrapper, '新增账户').trigger('click')
    await flushPromises()

    const editor = wrapper.get('.account-editor')
    expect(editor.findAll('form')).toHaveLength(2)
    expect(editor.find('form form').exists()).toBe(false)
    expect(editor.get('[aria-label="基础信息"] form').classes()).toContain('account-editor__basics')
    expect(editor.get('[aria-label="账户参数"] form').classes()).toContain(
      'plugin-schema-form__grid',
    )
    expect(editor.text()).not.toContain('敏感字段留空表示不修改')
  })

  it('creates an account with exact nested accountJson and unchanged outer fields', async () => {
    const recursiveValue = {
      accountKey: 'recursive-account',
      profiles: [
        {
          name: '主资料',
          externalId: 'external-new',
          secret: 'new-secret',
          tokens: [
            { tokenName: '主令牌', token: 'token-a' },
            { tokenName: '备用令牌', token: 'token-b' },
          ],
        },
      ],
    }
    getPluginAccountSchemaMock.mockResolvedValue(recursiveSchema)
    createPluginAccountMock.mockResolvedValue({
      groupId: null,
      groupName: null,
      installationId: 'installation-a',
      accountId: 'recursive-account',
      displayName: '',
      enabled: true,
      accountJson: '{}',
    })
    const wrapper = mountAccounts({
      actualForm: true,
      stubs: {
        PluginSchemaForm: pluginSchemaFormStub(recursiveValue),
        ElTabs: SlotStub,
        ElTabPane: SlotStub,
      },
    })
    await flushPromises()

    await buttonByText(wrapper, '新增账户').trigger('click')
    const createDialog = wrapper
      .findAllComponents(ElDialogStub)
      .find((candidate) => candidate.props('title') === '新增实例账户')
    expect(createDialog?.props('modelValue')).toBe(true)
    await wrapper.get('[data-testid="apply-recursive-account"]').trigger('click')
    await nextTick()
    expect(buttonByText(wrapper, '保存').attributes('disabled')).toBeUndefined()
    await invokeButtonHandler(wrapper, '保存')
    await flushPromises()

    expect(createPluginAccountMock).toHaveBeenCalledTimes(1)
    const [installationId, payload] = createPluginAccountMock.mock.calls[0]
    expect(installationId).toBe('installation-a')
    expect(payload).toMatchObject({
      accountId: 'recursive-account',
      displayName: undefined,
      enabled: true,
    })
    expect(JSON.parse(payload.accountJson)).toEqual(recursiveValue)
  })

  it('updates recursive accountJson while preserving nested readonly and sensitive values', async () => {
    const originalAccount = {
      accountKey: 'account-a',
      unknown: 'keep',
      profiles: [
        {
          name: '原名称',
          externalId: 'readonly-original',
          secret: '******',
          tokens: [{ tokenName: '原令牌', token: '********' }],
        },
      ],
    }
    const editedValue = {
      accountKey: 'account-a',
      profiles: [
        {
          name: '新名称',
          externalId: 'attempted-change',
          secret: '',
          tokens: [{ tokenName: '新令牌', token: '' }],
        },
      ],
    }
    getPluginAccountSchemaMock.mockResolvedValue(recursiveSchema)
    listPluginAccountsMock.mockResolvedValue({
      items: [listItem()],
      page: 1,
      size: 10,
      total: 1,
    })
    getPluginAccountMock.mockResolvedValue({
      groupId: null,
      groupName: null,
      installationId: 'installation-a',
      accountId: 'account-a',
      displayName: '详情名称',
      enabled: true,
      accountJson: JSON.stringify(originalAccount),
    })
    updatePluginAccountMock.mockResolvedValue({
      groupId: null,
      groupName: null,
      installationId: 'installation-a',
      accountId: 'account-a',
      displayName: '详情名称',
      enabled: true,
      accountJson: '{}',
    })
    const wrapper = mountAccounts({
      actualForm: true,
      stubs: {
        PluginSchemaForm: pluginSchemaFormStub(editedValue),
        ElTabs: SlotStub,
        ElTabPane: SlotStub,
      },
    })
    await flushPromises()

    await buttonByText(wrapper, '编辑').trigger('click')
    await flushPromises()
    const editDialog = wrapper
      .findAllComponents(ElDialogStub)
      .find((candidate) => candidate.props('title') === '编辑实例账户')
    expect(editDialog?.props('modelValue')).toBe(true)
    await wrapper.get('[data-testid="apply-recursive-account"]').trigger('click')
    await nextTick()
    expect(buttonByText(wrapper, '保存').attributes('disabled')).toBeUndefined()
    await invokeButtonHandler(wrapper, '保存')
    await flushPromises()

    expect(updatePluginAccountMock).toHaveBeenCalledTimes(1)
    const [installationId, accountId, payload] = updatePluginAccountMock.mock.calls[0]
    expect([installationId, accountId]).toEqual(['installation-a', 'account-a'])
    expect(payload).toMatchObject({
      accountId: 'account-a',
      displayName: '详情名称',
      enabled: true,
    })
    expect(JSON.parse(payload.accountJson)).toEqual({
      accountKey: 'account-a',
      unknown: 'keep',
      profiles: [
        {
          name: '新名称',
          externalId: 'readonly-original',
          secret: '******',
          tokens: [{ tokenName: '新令牌', token: '********' }],
        },
      ],
    })
  })
})

describe('AccountsView batch account deletion', () => {
  it('keeps the contextual action hidden without a selection or write permission', async () => {
    const account = accountItem('account-a')
    listPluginAccountsMock.mockResolvedValue({ items: [account], page: 1, size: 10, total: 1 })
    const wrapper = mountAccounts({
      actualPermissionGuard: true,
      permissions: ['plugin:account:read'],
    })
    await flushPromises()

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '批量删除')).toBe(
      false,
    )

    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [account])
    await nextTick()

    expect(wrapper.findAll('button').some((button) => button.text().trim() === '批量删除')).toBe(
      false,
    )
    expect(batchDeletePluginAccountsMock).not.toHaveBeenCalled()
  })

  it('shows the batch delete action for selected accounts with write permission', async () => {
    const account = accountItem('account-a')
    listPluginAccountsMock.mockResolvedValue({ items: [account], page: 1, size: 10, total: 1 })
    const wrapper = mountAccounts({
      actualPermissionGuard: true,
      permissions: ['plugin:account:read', 'plugin:account:write'],
    })
    await flushPromises()

    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [account])
    await nextTick()

    expect(buttonByText(wrapper, '批量删除').attributes('disabled')).toBeUndefined()
  })

  it('submits one batch request, refreshes, and clears selection when all deletions succeed', async () => {
    const accountA = accountItem('account-a')
    const accountB = accountItem('account-b')
    listPluginAccountsMock
      .mockResolvedValueOnce({ items: [accountA, accountB], page: 1, size: 10, total: 2 })
      .mockResolvedValueOnce({ items: [], page: 1, size: 10, total: 0 })
    batchDeletePluginAccountsMock.mockResolvedValue({
      installationId: 'installation-a',
      total: 2,
      succeeded: 2,
      failed: 0,
      receipts: [
        { accountId: 'account-a', success: true, message: 'Deleted' },
        { accountId: 'account-b', success: true, message: 'Deleted' },
      ],
    })
    const confirmSpy = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    const successSpy = vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [accountA, accountB])
    await nextTick()

    await buttonByText(wrapper, '批量删除').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith(
      '确定删除选中的 2 个插件账户吗？删除后无法恢复。',
      '批量删除插件账户',
      expect.objectContaining({ confirmButtonText: '确认删除' }),
    )
    expect(batchDeletePluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(batchDeletePluginAccountsMock).toHaveBeenCalledWith('installation-a', {
      accountIds: ['account-a', 'account-b'],
    })
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(2)
    expect(successSpy).toHaveBeenCalledWith('批量删除成功：已删除 2 个插件账户')
    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(toggleRowSelectionSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('已选择')
  })

  it('reports partial success, lists failures, and restores visible failed selections', async () => {
    const accountA = accountItem('account-a')
    const accountB = accountItem('account-b')
    listPluginAccountsMock
      .mockResolvedValueOnce({ items: [accountA, accountB], page: 1, size: 10, total: 2 })
      .mockResolvedValueOnce({ items: [accountB], page: 1, size: 10, total: 1 })
    batchDeletePluginAccountsMock.mockResolvedValue({
      installationId: 'installation-a',
      total: 2,
      succeeded: 1,
      failed: 1,
      receipts: [
        { accountId: 'account-a', success: true, message: 'Deleted' },
        { accountId: 'account-b', success: false, message: 'Plugin account not found' },
      ],
    })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    const warningSpy = vi.spyOn(ElMessage, 'warning').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [accountA, accountB])
    await nextTick()

    await buttonByText(wrapper, '批量删除').trigger('click')
    await flushPromises()

    expect(warningSpy).toHaveBeenCalledWith('删除完成：成功 1 个，失败 1 个')
    const resultDialog = wrapper
      .findAllComponents(ElDialogStub)
      .find((dialog) => dialog.props('title') === '批量删除结果')
    expect(resultDialog?.text()).toContain('account-b')
    expect(resultDialog?.text()).toContain('Plugin account not found')
    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(toggleRowSelectionSpy).toHaveBeenCalledWith(accountB, true)
    expect(wrapper.text()).toContain('已选择 1 个账户')
  })

  it('shows all failure reasons without refreshing or changing the current selection', async () => {
    const accountA = accountItem('account-a')
    const accountB = accountItem('account-b')
    listPluginAccountsMock.mockResolvedValue({
      items: [accountA, accountB],
      page: 1,
      size: 10,
      total: 2,
    })
    batchDeletePluginAccountsMock.mockResolvedValue({
      installationId: 'installation-a',
      total: 2,
      succeeded: 0,
      failed: 2,
      receipts: [
        { accountId: 'account-a', success: false, message: 'Account is in use' },
        { accountId: null, success: false, message: 'Unknown account receipt' },
      ],
    })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [accountA, accountB])
    await nextTick()

    await buttonByText(wrapper, '批量删除').trigger('click')
    await flushPromises()

    expect(errorSpy).toHaveBeenCalledWith('批量删除失败：2 个插件账户均未删除')
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(clearSelectionSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('account-a')
    expect(wrapper.text()).toContain('Account is in use')
    expect(wrapper.text()).toContain('未知账户')
    expect(wrapper.text()).toContain('Unknown account receipt')
    expect(wrapper.text()).toContain('已选择 2 个账户')
  })

  it('locks batch actions while confirmation is pending and prevents duplicate submission', async () => {
    const account = accountItem('account-a')
    listPluginAccountsMock.mockResolvedValue({ items: [account], page: 1, size: 10, total: 1 })
    const confirmation = deferred<unknown>()
    const confirmSpy = vi
      .spyOn(ElMessageBox, 'confirm')
      .mockReturnValue(confirmation.promise as never)
    batchDeletePluginAccountsMock.mockResolvedValue({
      installationId: 'installation-a',
      total: 1,
      succeeded: 0,
      failed: 1,
      receipts: [{ accountId: 'account-a', success: false, message: 'In use' }],
    })
    vi.spyOn(ElMessage, 'error').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [account])
    await nextTick()

    const deleteButton = buttonByText(wrapper, '批量删除')
    await deleteButton.trigger('click')
    await nextTick()
    expect(deleteButton.attributes('disabled')).toBeDefined()
    await deleteButton.trigger('click')
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(batchDeletePluginAccountsMock).not.toHaveBeenCalled()

    confirmation.resolve(undefined)
    await flushPromises()
    expect(batchDeletePluginAccountsMock).toHaveBeenCalledTimes(1)
  })

  it('moves back one page when the refreshed current page becomes empty', async () => {
    const firstPageAccount = accountItem('account-first')
    const secondPageAccount = accountItem('account-last')
    listPluginAccountsMock
      .mockResolvedValueOnce({ items: [firstPageAccount], page: 1, size: 10, total: 11 })
      .mockResolvedValueOnce({ items: [secondPageAccount], page: 2, size: 10, total: 11 })
      .mockResolvedValueOnce({ items: [], page: 2, size: 10, total: 10 })
      .mockResolvedValueOnce({ items: [firstPageAccount], page: 1, size: 10, total: 10 })
    batchDeletePluginAccountsMock.mockResolvedValue({
      installationId: 'installation-a',
      total: 1,
      succeeded: 1,
      failed: 0,
      receipts: [{ accountId: 'account-last', success: true, message: 'Deleted' }],
    })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    const table = wrapper.getComponent(PaginationTableStub)
    table.vm.$emit('page-change', 2)
    await flushPromises()
    table.vm.$emit('selection-change', [secondPageAccount])
    await nextTick()

    await buttonByText(wrapper, '批量删除').trigger('click')
    await flushPromises()

    expect(listPluginAccountsMock).toHaveBeenCalledTimes(4)
    expect(listPluginAccountsMock).toHaveBeenLastCalledWith(
      'installation-a',
      expect.objectContaining({ page: 1 }),
    )
  })

  it('leaves selection and local messages untouched when the overall request fails', async () => {
    const account = accountItem('account-a')
    listPluginAccountsMock.mockResolvedValue({ items: [account], page: 1, size: 10, total: 1 })
    batchDeletePluginAccountsMock.mockRejectedValue(new Error('HTTP 403'))
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    const successSpy = vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    const warningSpy = vi.spyOn(ElMessage, 'warning').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [account])
    await nextTick()

    await buttonByText(wrapper, '批量删除').trigger('click')
    await flushPromises()

    expect(successSpy).not.toHaveBeenCalled()
    expect(warningSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已选择 1 个账户')
    expect(buttonByText(wrapper, '批量删除').attributes('disabled')).toBeUndefined()
  })

  it('keeps the existing single-account deletion path unchanged', async () => {
    const account = accountItem('account-a')
    listPluginAccountsMock
      .mockResolvedValueOnce({ items: [account], page: 1, size: 10, total: 1 })
      .mockResolvedValueOnce({ items: [], page: 1, size: 10, total: 0 })
    deletePluginAccountMock.mockResolvedValue(undefined)
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    const wrapper = mountAccounts()
    await flushPromises()

    await buttonByText(wrapper, '删除').trigger('click')
    await flushPromises()

    expect(deletePluginAccountMock).toHaveBeenCalledWith('installation-a', 'account-a')
    expect(batchDeletePluginAccountsMock).not.toHaveBeenCalled()
  })
})

const accountGroup = { groupId: 12, name: '主账户', accountCount: 2, createdAt: '', updatedAt: '' }

function groupSelect(wrapper: VueWrapper, id: string) {
  return wrapper
    .findAllComponents({ name: 'ElSelect' })
    .find((component) => component.attributes('data-testid') === id)!
}

async function selectGroup(wrapper: VueWrapper, value: 'all' | 'ungrouped' | number) {
  groupSelect(wrapper, 'group-filter').vm.$emit('update:modelValue', value)
  await invokeButtonHandler(wrapper, '查询')
  await flushPromises()
}

describe('AccountsView account groups', () => {
  beforeEach(() => {
    vi.mocked(listPluginAccountGroups).mockResolvedValue([accountGroup])
    listPluginAccountsMock.mockResolvedValue({ items: [listItem()], page: 1, size: 10, total: 1 })
  })

  it('assigns the initial group on creation and keeps it outside account JSON', async () => {
    getPluginAccountSchemaMock.mockResolvedValue({
      installationId: 'installation-a',
      pluginId: 'demo.plugin',
      schema: {
        accountIdField: 'id',
        fields: [{ name: 'id', label: 'ID', type: 'TEXT', accountId: true }],
      },
    })
    createPluginAccountMock.mockResolvedValue({ ...listItem(), accountJson: '{}' })
    const wrapper = mountAccounts({
      actualForm: true,
      stubs: {
        PluginSchemaForm: pluginSchemaFormStub({ id: 'grouped-new' }),
        ElTabs: SlotStub,
        ElTabPane: SlotStub,
      },
    })
    await flushPromises()
    await buttonByText(wrapper, '新增账户').trigger('click')
    await wrapper.get('[data-testid="apply-recursive-account"]').trigger('click')
    groupSelect(wrapper, 'create-group').vm.$emit('update:modelValue', 12)
    await invokeButtonHandler(wrapper, '保存')
    expect(createPluginAccountMock).toHaveBeenCalledWith(
      'installation-a',
      expect.objectContaining({ groupId: 12 }),
    )
    expect(JSON.parse(createPluginAccountMock.mock.lastCall![1].accountJson)).toEqual({
      id: 'grouped-new',
    })
  })

  it('clamps pagination after moving the last account out of the filtered page', async () => {
    const last = accountItem('last')
    listPluginAccountsMock
      .mockReset()
      .mockResolvedValueOnce({ items: [listItem()], page: 1, size: 10, total: 11 })
      .mockResolvedValueOnce({ items: [last], page: 2, size: 10, total: 11 })
      .mockResolvedValueOnce({ items: [], page: 2, size: 10, total: 10 })
      .mockResolvedValue({ items: [listItem()], page: 1, size: 10, total: 10 })
    vi.mocked(batchUpdatePluginAccountsGroup).mockResolvedValue({
      installationId: 'installation-a',
      groupId: null,
      total: 1,
      succeeded: 1,
      failed: 0,
      receipts: [{ accountId: 'last', success: true, message: 'Updated' }],
    })
    const wrapper = mountAccounts()
    await flushPromises()
    groupSelect(wrapper, 'group-filter').vm.$emit('update:modelValue', 12)
    wrapper.getComponent(PaginationTableStub).vm.$emit('page-change', 2)
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [last])
    await flushPromises()
    await buttonByText(wrapper, '批量移动分组').trigger('click')
    await invokeButtonHandler(wrapper, '确认移动')
    expect(listPluginAccountsMock.mock.lastCall![1]).toMatchObject({ page: 1, groupId: 12 })
  })

  it('keeps the selection without reloading when every batch receipt fails', async () => {
    vi.mocked(batchUpdatePluginAccountsGroup).mockResolvedValue({
      installationId: 'installation-a',
      groupId: null,
      total: 1,
      succeeded: 0,
      failed: 1,
      receipts: [{ accountId: 'account-a', success: false, message: 'Not found' }],
    })
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [listItem()])
    await flushPromises()
    await buttonByText(wrapper, '批量移动分组').trigger('click')
    await invokeButtonHandler(wrapper, '确认移动')
    expect(listPluginAccountsMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Not found')
    expect(wrapper.text()).toContain('已选择 1 个账户')
  })

  it('keeps group and ungrouped filters mutually exclusive and resets pagination', async () => {
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('page-change', 3)
    await flushPromises()
    await selectGroup(wrapper, 12)
    expect(listPluginAccountsMock).toHaveBeenLastCalledWith(
      'installation-a',
      expect.objectContaining({ page: 1, groupId: 12 }),
    )
    expect(listPluginAccountsMock.mock.lastCall![1]).not.toHaveProperty('ungrouped')
    await selectGroup(wrapper, 'ungrouped')
    expect(listPluginAccountsMock.mock.lastCall![1]).toMatchObject({ ungrouped: true })
    expect(listPluginAccountsMock.mock.lastCall![1]).not.toHaveProperty('groupId')
    await invokeButtonHandler(wrapper, '重置')
    expect(listPluginAccountsMock.mock.lastCall![1]).not.toHaveProperty('groupId')
    expect(listPluginAccountsMock.mock.lastCall![1]).not.toHaveProperty('ungrouped')
  })

  it('copies export filters when opening instead of using later list changes', async () => {
    const wrapper = mountAccounts()
    await flushPromises()
    await selectGroup(wrapper, 12)
    await buttonByText(wrapper, '导出').trigger('click')
    await selectGroup(wrapper, 'ungrouped')
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    vi.mocked(exportPluginAccounts).mockResolvedValue(new Blob(['accountId\na']))
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const exportDialog = wrapper
      .findAllComponents(ElDialogStub)
      .find((dialog) => dialog.props('title') === '导出实例账户')!
    const button = exportDialog
      .findAllComponents(ElButtonStub)
      .find((candidate) => candidate.text() === '导出')!
    await (button.vm.$.vnode.props!.onClick as () => Promise<void>)()
    expect(exportPluginAccounts).toHaveBeenCalledWith(
      'installation-a',
      expect.objectContaining({ groupId: 12, format: 'csv' }),
    )
    expect(vi.mocked(exportPluginAccounts).mock.lastCall![1]).not.toHaveProperty('ungrouped')
  })

  it('keeps account data readable and disables moving after group load failure, then retries', async () => {
    vi.mocked(listPluginAccountGroups).mockRejectedValueOnce({ message: 'offline' })
    const wrapper = mountAccounts()
    await flushPromises()
    expect(wrapper.get('[data-testid="account-rows"]').text()).toContain('account-a')
    expect(buttonByText(wrapper, '移动分组').attributes('disabled')).toBeDefined()
    await invokeButtonHandler(wrapper, '重试分组')
    await flushPromises()
    expect(buttonByText(wrapper, '移动分组').attributes('disabled')).toBeUndefined()
  })

  it('moves a single account out using an explicit null without changing its JSON', async () => {
    vi.mocked(updatePluginAccountGroup).mockResolvedValue({ ...listItem(), accountJson: '{}' })
    const wrapper = mountAccounts()
    await flushPromises()
    await buttonByText(wrapper, '移动分组').trigger('click')
    await invokeButtonHandler(wrapper, '确认移动')
    expect(updatePluginAccountGroup).toHaveBeenCalledWith('installation-a', 'account-a', {
      groupId: null,
    })
    expect(updatePluginAccountMock).not.toHaveBeenCalled()
  })

  it('shows partial batch failures and restores visible failed selections', async () => {
    const first = accountItem('a'),
      second = accountItem('b')
    listPluginAccountsMock.mockResolvedValue({
      items: [first, second],
      page: 1,
      size: 10,
      total: 2,
    })
    vi.mocked(batchUpdatePluginAccountsGroup).mockResolvedValue({
      installationId: 'installation-a',
      groupId: 12,
      total: 2,
      succeeded: 1,
      failed: 1,
      receipts: [
        { accountId: 'a', success: true, message: 'Updated' },
        { accountId: 'b', success: false, message: 'Account not found' },
      ],
    })
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [first, second])
    await flushPromises()
    await buttonByText(wrapper, '批量移动分组').trigger('click')
    groupSelect(wrapper, 'move-group').vm.$emit('update:modelValue', 12)
    await invokeButtonHandler(wrapper, '确认移动')
    await flushPromises()
    expect(batchUpdatePluginAccountsGroup).toHaveBeenCalledWith('installation-a', {
      accountIds: ['a', 'b'],
      groupId: 12,
    })
    expect(wrapper.text()).toContain('Account not found')
    expect(toggleRowSelectionSpy).toHaveBeenCalledWith(second, true)
    expect(wrapper.text()).toContain('已选择 1 个账户')
  })

  it('retains the move dialog and selection after overall request failure', async () => {
    vi.mocked(batchUpdatePluginAccountsGroup).mockRejectedValue({
      status: 404,
      message: 'not found',
    })
    const wrapper = mountAccounts()
    await flushPromises()
    wrapper.getComponent(PaginationTableStub).vm.$emit('selection-change', [listItem()])
    await flushPromises()
    await buttonByText(wrapper, '批量移动分组').trigger('click')
    await invokeButtonHandler(wrapper, '确认移动')
    await flushPromises()
    expect(wrapper.text()).toContain('已选择 1 个账户')
    expect(buttonByText(wrapper, '确认移动').exists()).toBe(true)
    expect(clearSelectionSpy).not.toHaveBeenCalled()
  })

  it('ignores old group and move responses after changing installations', async () => {
    const pending = deferred<Awaited<ReturnType<typeof updatePluginAccountGroup>>>()
    vi.mocked(updatePluginAccountGroup).mockReturnValue(pending.promise)
    const wrapper = mountAccounts()
    await flushPromises()
    await selectGroup(wrapper, 12)
    await buttonByText(wrapper, '移动分组').trigger('click')
    const moving = invokeButtonHandler(wrapper, '确认移动')
    await wrapper.setProps({ installationId: 'installation-b' })
    listPluginAccountsMock.mockResolvedValue({
      items: [listItem('installation-b')],
      page: 1,
      size: 10,
      total: 1,
    })
    await flushPromises()
    const message = vi.spyOn(ElMessage, 'success')
    pending.resolve({ ...listItem(), accountJson: '{}' })
    await moving
    expect(message).not.toHaveBeenCalled()
    expect(groupSelect(wrapper, 'group-filter').props('modelValue')).toBe('all')
    expect(
      wrapper
        .findAllComponents(ElDialogStub)
        .find((dialog) => dialog.props('title') === '移动账户分组')!
        .props('modelValue'),
    ).toBe(false)
  })

  it('ignores a stale directory response after switching instances', async () => {
    const pending = deferred<(typeof accountGroup)[]>()
    vi.mocked(listPluginAccountGroups).mockReturnValueOnce(pending.promise).mockResolvedValue([])
    const wrapper = mountAccounts()
    await wrapper.setProps({ installationId: 'installation-b' })
    await flushPromises()
    pending.resolve([accountGroup])
    await flushPromises()
    await buttonByText(wrapper, '分组管理').trigger('click')
    expect(wrapper.getComponent(PluginAccountGroupManager).props('groups')).toEqual([])
  })

  it('returns to all accounts after deleting the active group', async () => {
    const wrapper = mountAccounts()
    await flushPromises()
    await selectGroup(wrapper, 12)
    await buttonByText(wrapper, '分组管理').trigger('click')
    wrapper.getComponent(PluginAccountGroupManager).vm.$emit('changed', 12)
    await flushPromises()
    expect(listPluginAccountsMock.mock.lastCall![1]).not.toHaveProperty('groupId')
    expect(groupSelect(wrapper, 'group-filter').props('modelValue')).toBe('all')
  })

  it('hides write actions from readers and skips the directory without read permission', async () => {
    const reader = mountAccounts({
      actualPermissionGuard: true,
      permissions: ['plugin:account:read'],
    })
    await flushPromises()
    expect(reader.text()).toContain('分组管理')
    expect(reader.text()).not.toContain('移动分组')
    reader.unmount()
    vi.mocked(listPluginAccountGroups).mockClear()
    const writer = mountAccounts({
      actualPermissionGuard: true,
      permissions: ['plugin:account:write'],
    })
    await flushPromises()
    expect(vi.mocked(listPluginAccountGroups)).not.toHaveBeenCalled()
    expect(writer.find('[data-testid="group-filter"]').exists()).toBe(false)
  })

  it('displays per-row import feedback and retains group semantics in the instructions', async () => {
    vi.mocked(importPluginAccounts).mockResolvedValue({
      installationId: 'installation-a',
      dryRun: true,
      totalRows: 1,
      successRows: 0,
      failedRows: 1,
      createdRows: 0,
      updatedRows: 0,
      rows: [
        {
          rowNumber: 2,
          accountId: 'bad',
          status: 'FAILED',
          operation: 'NONE',
          message: 'Invalid JSON array',
        },
      ],
    })
    const wrapper = mountAccounts()
    await flushPromises()
    await buttonByText(wrapper, '导入').trigger('click')
    const upload = wrapper.getComponent({ name: 'ElUpload' })
    await (upload.vm.$.vnode.props!['http-request'] as (options: { file: File }) => Promise<void>)({
      file: new File(['accountId\nbad'], 'accounts.csv'),
    })
    await flushPromises()
    const table = wrapper.getComponent({ name: 'ElTable' })
    expect(table.vm.$.vnode.props!.data).toEqual([
      {
        rowNumber: 2,
        accountId: 'bad',
        status: 'FAILED',
        operation: 'NONE',
        message: 'Invalid JSON array',
      },
    ])
  })
})
