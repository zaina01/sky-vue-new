/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listPluginOptions } from '@/api/plugins'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useResourceStore } from '@/stores/resource'

vi.mock('@/api/plugins', () => ({
  listPluginOptions: vi.fn(),
}))

const listPluginOptionsMock = vi.mocked(listPluginOptions)
const SelectStub = defineComponent({
  name: 'ElSelect',
  props: { modelValue: String, remoteMethod: Function },
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
})
const OptionStub = defineComponent({
  name: 'ElOption',
  props: { value: String, label: String },
  template: '<div><slot /></div>',
})

function mountSelect(modelValue = '') {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(PluginInstallationSelect, {
    props: { modelValue, usage: 'JOB' },
    global: {
      plugins: [pinia],
      stubs: {
        ElSelect: SelectStub,
        ElOption: OptionStub,
        ElTag: true,
      },
    },
  })
}

describe('PluginInstallationSelect', () => {
  beforeEach(() => {
    listPluginOptionsMock.mockResolvedValue({
      items: [
        {
          installationId: 'installation-a',
          pluginId: 'same.plugin',
          installationName: '实例 A',
          pluginName: '同一插件',
          version: '1.0.0',
          ownerUserId: 'user-a',
          ownerDepartmentId: 10,
          state: 'RUNNING',
        },
        {
          installationId: 'installation-b',
          pluginId: 'same.plugin',
          installationName: '实例 B',
          pluginName: '同一插件',
          version: '1.0.0',
          ownerUserId: 'user-b',
          ownerDepartmentId: 20,
          state: 'STOPPED',
        },
      ],
      page: 1,
      size: 30,
      total: 2,
    })
  })

  it('keeps same-plugin installations as separate values and emits installationId', async () => {
    const wrapper = mountSelect()
    await flushPromises()

    const options = wrapper.findAllComponents(OptionStub)
    expect(options.map((option) => option.props('value'))).toEqual([
      'installation-a',
      'installation-b',
    ])
    expect(options[0]?.props('label')).toContain('部门 10')
    expect(options[1]?.props('label')).toContain('实例 B')

    wrapper.getComponent(SelectStub).vm.$emit('update:modelValue', 'installation-b')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['installation-b'])
    expect(wrapper.emitted('select')?.at(-1)?.[0]).toMatchObject({
      installationId: 'installation-b',
      pluginId: 'same.plugin',
    })
  })

  it('reloads options after scoped resource invalidation', async () => {
    mountSelect()
    await flushPromises()

    useResourceStore().invalidate('pluginInstallations')
    await flushPromises()

    expect(listPluginOptionsMock).toHaveBeenCalledTimes(2)
  })

  it('passes the remote search function to Element Plus and reloads by keyword', async () => {
    const wrapper = mountSelect('installation-a')
    await flushPromises()

    const remoteMethod = wrapper.getComponent(SelectStub).props('remoteMethod') as (
      value: string,
    ) => Promise<void>
    expect(remoteMethod).toBeTypeOf('function')

    await remoteMethod('Frontend IT B')
    await flushPromises()

    expect(listPluginOptionsMock).toHaveBeenLastCalledWith({
      page: 1,
      size: 30,
      keyword: 'Frontend IT B',
      usage: 'JOB',
      state: '',
    })
  })
})
