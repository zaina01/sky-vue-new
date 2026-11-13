import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import DepartmentTreeSelect from '@/components/system/DepartmentTreeSelect.vue'
import type { DepartmentResponse } from '@/types/system'

const TreeSelectStub = defineComponent({
  name: 'ElTreeSelect',
  props: {
    modelValue: { type: [Number, Array, String, Object], default: null },
    data: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  template: '<div />',
})

function node(
  departmentId: number,
  enabled: boolean,
  children: DepartmentResponse[] = [],
): DepartmentResponse {
  return {
    departmentId,
    parentId: departmentId === 1 ? null : 1,
    departmentName: `部门 ${departmentId}`,
    sortOrder: 0,
    enabled,
    createdAt: '',
    updatedAt: '',
    children,
  }
}

const departments = [node(1, true, [node(2, false), node(3, false)])]

describe('DepartmentTreeSelect', () => {
  it('preserves and allows removing a selected disabled department only when opted in', async () => {
    const wrapper = mount(DepartmentTreeSelect, {
      props: {
        modelValue: [2],
        departments,
        multiple: true,
        onlyEnabled: true,
        preserveDisabledSelection: true,
        blockedIds: [1],
      },
      global: { stubs: { ElTreeSelect: TreeSelectStub } },
    })

    const data = wrapper.getComponent(TreeSelectStub).props('data') as Array<{
      value: number
      disabled: boolean
      label: string
      children: Array<{ value: number; disabled: boolean; label: string }>
    }>
    expect(data[0]?.disabled).toBe(true)
    expect(data[0]?.children[0]).toMatchObject({
      value: 2,
      disabled: false,
      label: '部门 2（已停用）',
    })
    expect(data[0]?.children[1]).toMatchObject({ value: 3, disabled: true })

    wrapper.getComponent(TreeSelectStub).vm.$emit('update:modelValue', [])
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('keeps a selected disabled user department visible but disabled by default', () => {
    const wrapper = mount(DepartmentTreeSelect, {
      props: {
        modelValue: 2,
        departments,
        onlyEnabled: true,
      },
      global: { stubs: { ElTreeSelect: TreeSelectStub } },
    })

    const data = wrapper.getComponent(TreeSelectStub).props('data') as Array<{
      children: Array<{ value: number; disabled: boolean; label: string }>
    }>
    expect(data[0]?.children[0]).toMatchObject({
      value: 2,
      disabled: true,
      label: '部门 2（已停用）',
    })
  })

  it('uses an empty string when clearing a list filter', async () => {
    const wrapper = mount(DepartmentTreeSelect, {
      props: { modelValue: 2, departments, emptyValue: '' },
      global: { stubs: { ElTreeSelect: TreeSelectStub } },
    })

    wrapper.getComponent(TreeSelectStub).vm.$emit('update:modelValue', undefined)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })
})
