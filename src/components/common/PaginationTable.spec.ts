/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PaginationTable from './PaginationTable.vue'

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0]

let resizeCallback: ResizeObserverCallback | undefined
const observeSpy = vi.fn()
const disconnectSpy = vi.fn()
const doLayoutSpy = vi.fn()
const clearSelectionSpy = vi.fn()
const toggleRowSelectionSpy = vi.fn()

class ResizeObserverStub implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }

  disconnect = disconnectSpy
  observe = observeSpy
  unobserve = vi.fn()
}

const ElTableStub = defineComponent({
  name: 'ElTable',
  inheritAttrs: false,
  props: { flexible: Boolean },
  setup(_, { expose }) {
    expose({
      clearSelection: clearSelectionSpy,
      doLayout: doLayoutSpy,
      toggleRowSelection: toggleRowSelectionSpy,
    })
  },
  template: '<div class="el-table-stub"><slot /></div>',
})

const ElPaginationStub = defineComponent({
  name: 'ElPagination',
  template: '<div />',
})

function resizeEntry(width: number): ResizeObserverEntry {
  return {
    borderBoxSize: [],
    contentBoxSize: [],
    contentRect: { width } as DOMRectReadOnly,
    devicePixelContentBoxSize: [],
    target: document.createElement('div'),
  }
}

function mountTable() {
  return mount(PaginationTable, {
    props: { loading: false, total: 0, page: 1, size: 10 },
    global: {
      stubs: {
        ElTable: ElTableStub,
        ElPagination: ElPaginationStub,
      },
    },
  })
}

beforeEach(() => {
  resizeCallback = undefined
  observeSpy.mockClear()
  disconnectSpy.mockClear()
  doLayoutSpy.mockClear()
  clearSelectionSpy.mockClear()
  toggleRowSelectionSpy.mockClear()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1114,
  } as DOMRect)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PaginationTable responsive layout', () => {
  it('enables Element Plus flexible layout and constrains its container width', () => {
    const wrapper = mountTable()

    expect(wrapper.getComponent(ElTableStub).props('flexible')).toBe(true)
    expect(wrapper.get('.pagination-table').attributes('style')).toBeUndefined()
    expect(observeSpy).toHaveBeenCalledWith(wrapper.get('.pagination-table').element)
  })

  it('relayouts when the container shrinks from 1114px to 1099px only once', async () => {
    mountTable()

    resizeCallback?.([resizeEntry(1099)], {} as ResizeObserver)
    await flushPromises()
    expect(doLayoutSpy).toHaveBeenCalledTimes(1)

    resizeCallback?.([resizeEntry(1099)], {} as ResizeObserver)
    await flushPromises()
    expect(doLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('disconnects the observer and skips pending layout after unmount', async () => {
    const wrapper = mountTable()

    resizeCallback?.([resizeEntry(1099)], {} as ResizeObserver)
    wrapper.unmount()
    await flushPromises()

    expect(disconnectSpy).toHaveBeenCalledTimes(1)
    expect(doLayoutSpy).not.toHaveBeenCalled()
  })

  it('forwards selection controls to the Element Plus table instance', () => {
    const wrapper = mountTable()
    const row = { accountId: 'account-a' }

    wrapper.vm.clearSelection()
    wrapper.vm.toggleRowSelection(row, true)

    expect(clearSelectionSpy).toHaveBeenCalledTimes(1)
    expect(toggleRowSelectionSpy).toHaveBeenCalledWith(row, true)
  })
})
