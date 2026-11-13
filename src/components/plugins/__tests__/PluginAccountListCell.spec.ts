import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PluginAccountListCell from '@/components/plugins/PluginAccountListCell.vue'
import type { PluginAccountListField } from '@/types/plugins'

const ElTagStub = { template: '<span class="tag"><slot /></span>' }

function mountCell(field: PluginAccountListField, value: unknown) {
  return mount(PluginAccountListCell, {
    props: { field, value },
    global: { stubs: { ElTag: ElTagStub } },
  })
}

function field(type: PluginAccountListField['type']): PluginAccountListField {
  return { name: 'value', label: '值', type, options: ['华东', '华南'] }
}

describe('PluginAccountListCell', () => {
  it('leaves long text available for the table overflow tooltip', () => {
    const value = '这是一段超过二十四个字符、应当截断并展示完整提示的账户字段文本'
    const wrapper = mountCell(field('TEXT'), value)

    expect(wrapper.get('.account-list-text').text()).toBe(value)
  })

  it('renders select and radio option text as the string value itself', () => {
    expect(mountCell(field('SELECT'), '华东').text()).toBe('华东')
    expect(mountCell(field('RADIO'), '华南').text()).toBe('华南')
  })

  it('preserves both boolean states for switch and checkbox fields', () => {
    expect(mountCell(field('SWITCH'), true).text()).toBe('启用')
    expect(mountCell(field('SWITCH'), false).text()).toBe('停用')
    expect(mountCell(field('CHECKBOX'), true).text()).toBe('是')
    expect(mountCell(field('CHECKBOX'), false).text()).toBe('否')
  })

  it('renders multi-select arrays as a group of tags and handles empty values', () => {
    const wrapper = mountCell(field('MULTI_SELECT'), ['华东', '华南'])
    expect(wrapper.findAll('.tag').map((tag) => tag.text())).toEqual(['华东', '华南'])
    expect(mountCell(field('MULTI_SELECT'), []).text()).toBe('-')
  })

  it('renders checkbox arrays as tags while keeping false and zero values', () => {
    expect(
      mountCell(field('CHECKBOX'), ['华东', false, 0])
        .findAll('.tag')
        .map((tag) => tag.text()),
    ).toEqual(['华东', 'false', '0'])
    expect(mountCell(field('CHECKBOX'), []).text()).toBe('-')
    expect(mountCell(field('CHECKBOX'), null).text()).toBe('-')
  })
})
