/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, inject, provide, type PropType } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUser } from '@/api/auth'
import { getUser, listDepartments, listRoles, listUsers, updateUser } from '@/api/system'
import UsersView from '@/views/system/UsersView.vue'
import type { CurrentUser } from '@/types/auth'
import type { DepartmentResponse, UserItem } from '@/types/system'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/api/system', () => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  listDepartments: vi.fn(),
  listRoles: vi.fn(),
  listUsers: vi.fn(),
  resetUserPassword: vi.fn(),
  setUserEnabled: vi.fn(),
  updateUser: vi.fn(),
  updateUserRoles: vi.fn(),
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)
const getUserMock = vi.mocked(getUser)
const listDepartmentsMock = vi.mocked(listDepartments)
const listRolesMock = vi.mocked(listRoles)
const listUsersMock = vi.mocked(listUsers)
const updateUserMock = vi.mocked(updateUser)

const departments: DepartmentResponse[] = [
  {
    departmentId: 1,
    parentId: null,
    departmentName: '总部',
    sortOrder: 0,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    children: [
      {
        departmentId: 2,
        parentId: 1,
        departmentName: '已停用部门',
        sortOrder: 0,
        enabled: false,
        createdAt: '',
        updatedAt: '',
        children: [],
      },
      {
        departmentId: 3,
        parentId: 1,
        departmentName: '启用部门',
        sortOrder: 1,
        enabled: true,
        createdAt: '',
        updatedAt: '',
        children: [],
      },
    ],
  },
]

const user: UserItem = {
  userId: 'user-1',
  username: 'tester',
  email: 'tester@example.com',
  phone: '13800000000',
  avatar: null,
  departmentId: 2,
  departmentName: '已停用部门',
  enabled: true,
  createdAt: '2026-08-02T00:00:00',
  updatedAt: '2026-08-02T00:00:00',
  roles: ['USER'],
  permissions: [],
}

const currentUser: CurrentUser = {
  userId: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  departmentId: 1,
  departmentName: '总部',
  registerTime: '2026-08-02T00:00:00',
  roles: ['ADMIN'],
  permissions: ['system:user:read', 'system:user:write'],
}

const tableRowsKey = Symbol('table-rows')
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const PageContainerStub = defineComponent({
  template: '<main><slot name="extra" /><slot /></main>',
})
const PermissionGuardStub = defineComponent({ template: '<div><slot /></div>' })
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
const PaginationTableStub = defineComponent({
  name: 'PaginationTable',
  props: { data: { type: Array as PropType<unknown[]>, default: () => [] } },
  setup(props, { slots }) {
    provide(tableRowsKey, () => props.data)
    return () => h('div', slots.default?.())
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
type Validator = (rule: unknown, value: unknown, callback: (error?: Error) => void) => void
const FormStub = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    rules: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  },
  setup(props, { expose, slots }) {
    async function validate() {
      const configured = props.rules.departmentId
      const departmentRules = Array.isArray(configured)
        ? configured
        : configured
          ? [configured]
          : []
      for (const item of departmentRules) {
        const validator = (item as { validator?: Validator }).validator
        if (!validator) continue
        await new Promise<void>((resolve, reject) => {
          validator({}, props.model.departmentId, (error) => (error ? reject(error) : resolve()))
        })
      }
      return true
    }
    expose({ validate, clearValidate: () => undefined })
    return () => h('form', slots.default?.())
  },
})
const DepartmentTreeSelectStub = defineComponent({
  name: 'DepartmentTreeSelect',
  props: {
    modelValue: { type: [Number, Array, String, Object], default: null },
  },
  emits: ['update:modelValue'],
  setup(props) {
    return { displayValue: computed(() => String(props.modelValue ?? '')) }
  },
  template: '<span data-testid="department-select">{{ displayValue }}</span>',
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(UsersView, {
    global: {
      plugins: [pinia],
      stubs: {
        PageContainer: PageContainerStub,
        PermissionGuard: PermissionGuardStub,
        PaginationTable: PaginationTableStub,
        DepartmentTreeSelect: DepartmentTreeSelectStub,
        ElAlert: SlotStub,
        ElButton: ButtonStub,
        ElDialog: DialogStub,
        ElForm: FormStub,
        ElFormItem: SlotStub,
        ElInput: SlotStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElSkeleton: SlotStub,
        ElSwitch: SlotStub,
        ElTableColumn: TableColumnStub,
        ElTag: SlotStub,
        ElTooltip: SlotStub,
      },
    },
  })
}

function findButton(wrapper: ReturnType<typeof mountView>, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}

describe('UsersView enabled primary department validation', () => {
  beforeEach(() => {
    listUsersMock.mockResolvedValue({ items: [user], page: 1, size: 10, total: 1 })
    listDepartmentsMock.mockResolvedValue(departments)
    listRolesMock.mockResolvedValue({ items: [], page: 1, size: 100, total: 0 })
    getUserMock.mockResolvedValue(user)
    updateUserMock.mockResolvedValue(user)
    getCurrentUserMock.mockResolvedValue(currentUser)
  })

  it('blocks an unchanged disabled primary department and allows an enabled replacement', async () => {
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '编辑').trigger('click')
    await flushPromises()

    const departmentSelect = wrapper
      .findAllComponents(DepartmentTreeSelectStub)
      .find((item) => item.props('modelValue') === 2)
    expect(departmentSelect).toBeDefined()

    await findButton(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(updateUserMock).not.toHaveBeenCalled()

    departmentSelect!.vm.$emit('update:modelValue', 3)
    await wrapper.vm.$nextTick()
    await findButton(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(updateUserMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ departmentId: 3 }),
    )
  })
})
