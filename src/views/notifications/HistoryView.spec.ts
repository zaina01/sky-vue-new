/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listHistory } from '@/api/notifications'
import HistoryView from '@/views/notifications/HistoryView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/api/notifications', () => ({
  getHistory: vi.fn(),
  listHistory: vi.fn(),
  retryHistory: vi.fn(),
}))

const listHistoryMock = vi.mocked(listHistory)

const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const ButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
})
const DatePickerStub = defineComponent({
  name: 'ElDatePicker',
  props: {
    modelValue: { type: String, default: '' },
    valueFormat: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: '<input />',
})
const DialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean },
  template: '<section v-if="modelValue"><slot /></section>',
})
const TableColumnStub = defineComponent({
  name: 'ElTableColumn',
  template: '<div />',
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(HistoryView, {
    global: {
      plugins: [pinia],
      stubs: {
        ElButton: ButtonStub,
        ElDatePicker: DatePickerStub,
        ElDescriptions: SlotStub,
        ElDescriptionsItem: SlotStub,
        ElDialog: DialogStub,
        ElForm: SlotStub,
        ElFormItem: SlotStub,
        ElInput: SlotStub,
        ElOption: SlotStub,
        ElSelect: SlotStub,
        ElSkeleton: SlotStub,
        ElTableColumn: TableColumnStub,
        ElTag: SlotStub,
        OwnerSummary: SlotStub,
        PageContainer: SlotStub,
        PaginationTable: SlotStub,
        PermissionGuard: SlotStub,
        PluginDefinitionSelect: SlotStub,
        PluginInstallationSelect: SlotStub,
      },
    },
  })
}

function queryButton(wrapper: ReturnType<typeof mountView>) {
  const result = wrapper.findAll('button').find((item) => item.text().trim() === '查询')
  if (!result) throw new Error('未找到查询按钮')
  return result
}

describe('HistoryView time filters', () => {
  beforeEach(() => {
    listHistoryMock.mockReset()
    listHistoryMock.mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })
  })

  it('submits exact ISO local date-times accepted by the backend', async () => {
    const wrapper = mountView()
    await flushPromises()

    const datePickers = wrapper.findAllComponents(DatePickerStub)
    expect(datePickers).toHaveLength(2)
    expect(datePickers.map((picker) => picker.props('valueFormat'))).toEqual([
      'YYYY-MM-DDTHH:mm:ss',
      'YYYY-MM-DDTHH:mm:ss',
    ])

    const selectedTime = '2026-09-22T00:00:00'
    datePickers[0]?.vm.$emit('update:modelValue', selectedTime)
    datePickers[1]?.vm.$emit('update:modelValue', selectedTime)
    await queryButton(wrapper).trigger('click')
    await flushPromises()

    expect(listHistoryMock).toHaveBeenLastCalledWith({
      sourceType: '',
      channelId: '',
      channelType: '',
      status: '',
      installationId: '',
      pluginId: '',
      jobId: '',
      executionId: '',
      startTime: selectedTime,
      endTime: selectedTime,
      page: 1,
      size: 10,
    })
  })
})
