import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PluginAccountColumnSettings from '@/components/plugins/PluginAccountColumnSettings.vue'
import type { PluginAccountListField } from '@/types/plugins'

const availableFields: PluginAccountListField[] = Array.from({ length: 6 }, (_, index) => ({
  name: `field-${index + 1}`,
  label: `字段 ${index + 1}`,
  type: 'TEXT',
  options: [],
}))

const ElCheckboxStub = {
  inheritAttrs: false,
  props: ['value', 'disabled'],
  emits: ['change'],
  template:
    '<label><input class="checkbox" type="checkbox" :value="value" :disabled="disabled" @change="$emit(\'change\', $event.target.checked)" /><slot /></label>',
}

function mountSettings(modelValue: string[], maxFields = 5) {
  return mount(PluginAccountColumnSettings, {
    props: { modelValue, availableFields, maxFields },
    global: {
      stubs: {
        ElAlert: { props: ['title'], template: '<div class="alert">{{ title }}</div>' },
        ElCheckbox: ElCheckboxStub,
        ElCheckboxGroup: { template: '<div><slot /></div>' },
        ElEmpty: { props: ['description'], template: '<div class="empty">{{ description }}</div>' },
      },
    },
  })
}

describe('PluginAccountColumnSettings', () => {
  it('disables unselected fields and displays a limit message at maxFields', () => {
    const wrapper = mountSettings(availableFields.slice(0, 5).map((field) => field.name))

    expect(wrapper.get('.alert').text()).toContain('最多可选择 5 个字段')
    expect(wrapper.findAll('.checkbox').at(5)?.attributes()).toHaveProperty('disabled')
  })

  it('appends a field only while below the selection limit', async () => {
    const wrapper = mountSettings(['field-1'])
    await wrapper.findAll('.checkbox').at(1)?.setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['field-1', 'field-2'])
  })

  it('emits selected fields in drag order', async () => {
    const wrapper = mountSettings(['field-1', 'field-2', 'field-3'])
    const selected = wrapper.findAll('.column-settings__selected-item')

    await selected[2]?.trigger('dragstart', {
      dataTransfer: { effectAllowed: '', setData: () => undefined },
    })
    await selected[0]?.trigger('drop')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'field-3',
      'field-1',
      'field-2',
    ])

    await wrapper.setProps({ modelValue: ['field-1', 'field-2', 'field-3'] })
    const refreshed = wrapper.findAll('.column-settings__selected-item')
    await refreshed[0]?.trigger('dragstart', {
      dataTransfer: { effectAllowed: '', setData: () => undefined },
    })
    await refreshed[2]?.trigger('drop')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'field-2',
      'field-3',
      'field-1',
    ])
  })
})
