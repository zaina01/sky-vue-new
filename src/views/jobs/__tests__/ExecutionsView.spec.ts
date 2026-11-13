/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listExecutions } from '@/api/jobs'
import { listDepartments } from '@/api/system'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import type { JobExecutionItem } from '@/types/jobs'
import type { DepartmentResponse } from '@/types/system'
import ExecutionsView from '@/views/jobs/ExecutionsView.vue'

vi.mock('@/api/jobs', () => ({ cancelExecution: vi.fn(), listExecutions: vi.fn() }))
vi.mock('@/api/system', () => ({ listDepartments: vi.fn() }))

const listExecutionsMock = vi.mocked(listExecutions)
const listDepartmentsMock = vi.mocked(listDepartments)

function execution(
  ownerDepartmentId: number | null,
  ownerDepartmentName?: string | null,
): JobExecutionItem {
  return {
    id: 1,
    jobId: 1,
    pluginId: 'plugin-a',
    pluginInstallationId: 'installation-a',
    ownerUserId: 'user-1',
    ownerDepartmentId,
    ownerDepartmentName,
    status: 'SUCCESS',
    jobName: '任务 A',
  }
}

const departments: DepartmentResponse[] = [
  {
    departmentId: 2,
    parentId: null,
    departmentName: '研发部',
    sortOrder: 0,
    enabled: true,
    createdAt: '2026-08-02T00:00:00',
    updatedAt: '2026-08-02T00:00:00',
    children: [],
  },
]

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
let currentExecutionRow: JobExecutionItem
const ColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_props, { slots }) {
    return () => h('section', slots.default?.({ row: currentExecutionRow }))
  },
})
const TooltipStub = defineComponent({
  name: 'ElTooltip',
  props: { content: { type: String, default: '' } },
  template: '<span data-testid="tooltip" :data-content="content"><slot /></span>',
})

function mountView(row: JobExecutionItem, permissions: string[]) {
  currentExecutionRow = row
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile(user(permissions))
  return mount(ExecutionsView, {
    global: {
      plugins: [pinia],
      stubs: {
        ElButton: SlotStub,
        ElForm: SlotStub,
        ElFormItem: SlotStub,
        ElInput: SlotStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElTableColumn: ColumnStub,
        ElTag: SlotStub,
        ElTooltip: TooltipStub,
        PageContainer: SlotStub,
        PaginationTable: SlotStub,
        PermissionGuard: SlotStub,
        PluginInstallationSelect: SlotStub,
        RouterLink: SlotStub,
      },
    },
  })
}

describe('ExecutionsView department names', () => {
  beforeEach(() => {
    listExecutionsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
    listDepartmentsMock.mockResolvedValue(departments)
  })

  it('prefers the DTO snapshot name over the department tree', async () => {
    const wrapper = mountView(execution(2, '执行快照部门'), [
      'job:execution:read',
      'system:department:read',
    ])
    await flushPromises()

    expect(wrapper.text()).toContain('执行快照部门')
    expect(
      wrapper
        .findAll('[data-testid="tooltip"]')
        .some((item) => item.attributes('data-content') === '执行快照部门（2）'),
    ).toBe(true)
  })

  it('uses the tree name when no snapshot exists', async () => {
    const wrapper = mountView(execution(2), ['job:execution:read', 'system:department:read'])
    await flushPromises()

    expect(wrapper.text()).toContain('研发部')
  })

  it('does not request departments without permission and falls back to the department ID', async () => {
    const wrapper = mountView(execution(9), ['job:execution:read'])
    await flushPromises()

    expect(listDepartmentsMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('部门 9')
  })
})
