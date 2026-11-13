import { flushPromises, mount, shallowMount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getExecution, getExecutionLogs } from '@/api/jobs'
import { listPluginServiceCalls } from '@/api/plugins'
import { listDepartments } from '@/api/system'
import { useUserStore } from '@/stores/user'
import type { CurrentUser } from '@/types/auth'
import ExecutionDetailView from '@/views/jobs/ExecutionDetailView.vue'
import type { ExecutionLogChunk, JobExecutionDetail } from '@/types/jobs'
import type { DepartmentResponse } from '@/types/system'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '73' } }),
}))

vi.mock('@/api/jobs', () => ({
  getExecution: vi.fn(),
  getExecutionLogs: vi.fn(),
}))

vi.mock('@/api/plugins', () => ({
  getPluginServiceCallRunnerLog: vi.fn(),
  listPluginServiceCalls: vi.fn(),
}))

vi.mock('@/api/system', () => ({
  listDepartments: vi.fn(),
}))

const getExecutionMock = vi.mocked(getExecution)
const getExecutionLogsMock = vi.mocked(getExecutionLogs)
const listServiceCallsMock = vi.mocked(listPluginServiceCalls)
const listDepartmentsMock = vi.mocked(listDepartments)

function execution(status: JobExecutionDetail['status']): JobExecutionDetail {
  return {
    id: 73,
    jobId: 1,
    pluginId: 'frontend-integration',
    pluginInstallationId: 'task-installation-b',
    ownerUserId: 'user-1',
    ownerDepartmentId: 2,
    status,
    jobName: 'Frontend IT Job',
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

function currentUser(permissions: string[]): CurrentUser {
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

const missingLog: ExecutionLogChunk = {
  executionId: 73,
  exists: false,
  content: '',
  offset: 0,
  nextOffset: 0,
  limitBytes: 65_536,
  sizeBytes: 0,
  eof: true,
  truncated: false,
}

function availableLog(
  content: string,
  offset: number,
  nextOffset: number,
  sizeBytes: number,
): ExecutionLogChunk {
  return {
    executionId: 73,
    runnerLogPath: 'D:/runner.log',
    exists: true,
    content,
    offset,
    nextOffset,
    limitBytes: 65_536,
    sizeBytes,
    eof: nextOffset >= sizeBytes,
    truncated: offset > 0,
  }
}

function mountView(permissions: string[] = []) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile(currentUser(permissions))
  return mount(ExecutionDetailView, {
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        PageBackButton: true,
        PageContainer: { template: '<main><slot name="header" /><slot /></main>' },
        PermissionGuard: { template: '<div><slot /></div>' },
        OwnerSummary: true,
        PaginationTable: true,
      },
    },
  })
}

function findButton(wrapper: VueWrapper, label: string) {
  const result = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!result) throw new Error(`未找到按钮：${label}`)
  return result
}

describe('ExecutionDetailView execution polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    getExecutionMock.mockReset()
    getExecutionLogsMock.mockReset()
    listServiceCallsMock.mockReset()
    listDepartmentsMock.mockReset()
    listDepartmentsMock.mockResolvedValue(departments)
    getExecutionMock
      .mockResolvedValueOnce(execution('RUNNING'))
      .mockResolvedValueOnce(execution('SUCCESS'))
    getExecutionLogsMock.mockResolvedValue(missingLog)
    listServiceCallsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps polling the route executionId until terminal even when the log does not exist yet', async () => {
    const wrapper = shallowMount(ExecutionDetailView, {
      global: { plugins: [createPinia()], directives: { loading: () => undefined } },
    })
    await flushPromises()
    expect(getExecutionMock).toHaveBeenCalledTimes(1)
    expect(getExecutionMock).toHaveBeenLastCalledWith('73')

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(getExecutionMock).toHaveBeenCalledTimes(2)
    expect(getExecutionMock).toHaveBeenLastCalledWith('73')
    expect(listServiceCallsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })
})

describe('ExecutionDetailView bounded log window', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    getExecutionMock.mockReset()
    getExecutionLogsMock.mockReset()
    listServiceCallsMock.mockReset()
    listDepartmentsMock.mockReset()
    listDepartmentsMock.mockResolvedValue(departments)
    getExecutionMock.mockResolvedValue(execution('SUCCESS'))
    listServiceCallsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
    vi.mocked(navigator.clipboard.writeText).mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders log segments, requests the next offset, copies the current window, and resets to tail', async () => {
    getExecutionLogsMock
      .mockResolvedValueOnce(availableLog('old-', 0, 65_536, 131_072))
      .mockResolvedValueOnce(availableLog('new', 65_536, 131_072, 131_072))
      .mockResolvedValueOnce(availableLog('tail', 120_000, 131_072, 131_072))

    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '加载更新').trigger('click')
    await flushPromises()

    expect(getExecutionLogsMock).toHaveBeenNthCalledWith(2, '73', {
      offset: 65_536,
      limitBytes: 65_536,
    })
    expect(wrapper.find('.terminal-panel pre').element.textContent).toBe('old-new')
    expect(wrapper.findAll('[data-log-segment-key]')).toHaveLength(2)
    expect(wrapper.text()).toContain('窗口：128.0 KB / 2.00 MB')

    await findButton(wrapper, '复制当前窗口').trigger('click')
    await flushPromises()
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('old-new')

    await findButton(wrapper, '尾部加载').trigger('click')
    await flushPromises()

    expect(getExecutionLogsMock).toHaveBeenNthCalledWith(3, '73', { tailBytes: 256 * 1024 })
    expect(wrapper.find('.terminal-panel pre').element.textContent).toBe('tail')
    expect(wrapper.findAll('[data-log-segment-key]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('unmounts the inline log while the expanded viewer is active', async () => {
    getExecutionLogsMock.mockResolvedValue(availableLog('tail', 0, 4, 4))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.terminal-panel').exists()).toBe(true)
    await findButton(wrapper, '放大').trigger('click')
    await flushPromises()

    expect(wrapper.find('.terminal-panel').exists()).toBe(false)
    expect(document.body.querySelectorAll('.terminal-panel')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps the existing log segment anchored when earlier logs are prepended', async () => {
    let resolvePrevious!: (value: ExecutionLogChunk) => void
    const previousRequest = new Promise<ExecutionLogChunk>((resolve) => {
      resolvePrevious = resolve
    })
    getExecutionLogsMock
      .mockResolvedValueOnce(availableLog('new', 65_536, 131_072, 131_072))
      .mockReturnValueOnce(previousRequest)

    const wrapper = mountView()
    await flushPromises()

    const viewer = wrapper.find<HTMLElement>('.terminal-panel')
    const anchor = wrapper.find<HTMLElement>('[data-log-segment-key="65536:131072"]')
    let anchorTop = 10
    vi.spyOn(anchor.element, 'getBoundingClientRect').mockImplementation(
      () => ({ top: anchorTop }) as DOMRect,
    )
    Object.defineProperty(viewer.element, 'scrollHeight', { configurable: true, value: 200 })
    Object.defineProperty(viewer.element, 'clientHeight', { configurable: true, value: 100 })
    viewer.element.scrollTop = 0

    await viewer.trigger('scroll')
    expect(getExecutionLogsMock).toHaveBeenNthCalledWith(2, '73', {
      offset: 0,
      limitBytes: 65_536,
    })

    anchorTop = 60
    resolvePrevious(availableLog('old', 0, 65_536, 131_072))
    await flushPromises()

    expect(viewer.element.scrollTop).toBe(50)
    expect(viewer.element.querySelector('pre')?.textContent).toBe('oldnew')
    wrapper.unmount()
  })

  it('does not jump back to the tail when the user scrolls up during a live log request', async () => {
    let resolveNext!: (value: ExecutionLogChunk) => void
    const nextRequest = new Promise<ExecutionLogChunk>((resolve) => {
      resolveNext = resolve
    })
    getExecutionLogsMock
      .mockResolvedValueOnce(availableLog('old', 0, 65_536, 131_072))
      .mockReturnValueOnce(nextRequest)

    const wrapper = mountView()
    await flushPromises()

    const viewer = wrapper.find<HTMLElement>('.terminal-panel')
    Object.defineProperty(viewer.element, 'scrollHeight', { configurable: true, value: 300 })
    Object.defineProperty(viewer.element, 'clientHeight', { configurable: true, value: 100 })
    viewer.element.scrollTop = 200
    await viewer.trigger('scroll')

    expect(getExecutionLogsMock).toHaveBeenNthCalledWith(2, '73', {
      offset: 65_536,
      limitBytes: 65_536,
    })

    viewer.element.scrollTop = 190
    await viewer.trigger('scroll')
    resolveNext(availableLog('new', 65_536, 131_072, 131_072))
    await flushPromises()

    expect(viewer.element.scrollTop).toBe(190)
    expect(viewer.element.querySelector('pre')?.textContent).toBe('oldnew')
    wrapper.unmount()
  })
})

describe('ExecutionDetailView department names', () => {
  beforeEach(() => {
    getExecutionMock.mockReset()
    getExecutionLogsMock.mockReset()
    listServiceCallsMock.mockReset()
    listDepartmentsMock.mockReset()
    getExecutionMock.mockResolvedValue(execution('SUCCESS'))
    getExecutionLogsMock.mockResolvedValue(missingLog)
    listServiceCallsMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
    listDepartmentsMock.mockResolvedValue(departments)
  })

  it('prefers the response snapshot and otherwise resolves the department tree', async () => {
    getExecutionMock.mockResolvedValueOnce({
      ...execution('SUCCESS'),
      ownerDepartmentName: '执行快照部门',
    })
    const snapshotWrapper = mountView(['system:department:read'])
    await flushPromises()
    await findButton(snapshotWrapper, '展开详情').trigger('click')
    expect(snapshotWrapper.text()).toContain('所属部门')
    expect(snapshotWrapper.text()).toContain('执行快照部门')
    snapshotWrapper.unmount()

    getExecutionMock.mockResolvedValueOnce(execution('SUCCESS'))
    const treeWrapper = mountView(['system:department:read'])
    await flushPromises()
    await findButton(treeWrapper, '展开详情').trigger('click')
    expect(treeWrapper.text()).toContain('研发部')
    treeWrapper.unmount()
  })

  it('skips the directory without permission and falls back to the department ID', async () => {
    const wrapper = mountView()
    await flushPromises()
    await findButton(wrapper, '展开详情').trigger('click')

    expect(listDepartmentsMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('部门 2')
    wrapper.unmount()
  })

  it('does not reload the department tree during execution and log polling', async () => {
    vi.useFakeTimers()
    getExecutionMock
      .mockReset()
      .mockResolvedValueOnce(execution('RUNNING'))
      .mockResolvedValueOnce(execution('SUCCESS'))

    const wrapper = mountView(['system:department:read'])
    await flushPromises()
    expect(listDepartmentsMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(listDepartmentsMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    vi.useRealTimers()
  })
})
