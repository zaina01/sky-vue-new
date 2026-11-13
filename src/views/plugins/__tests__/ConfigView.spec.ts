/* eslint-disable vue/one-component-per-file */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPluginConfig, updatePluginConfig } from '@/api/plugins'
import ConfigView from '@/views/plugins/ConfigView.vue'
import type { PluginConfigResponse } from '@/types/plugins'

vi.mock('@/api/plugins', () => ({
  getPluginConfig: vi.fn(),
  updatePluginConfig: vi.fn(),
}))

const getPluginConfigMock = vi.mocked(getPluginConfig)
const updatePluginConfigMock = vi.mocked(updatePluginConfig)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const JsonEditorStub = defineComponent({
  name: 'JsonEditor',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue', 'valid-change'],
  template: '<pre data-testid="json-editor">{{ modelValue }}</pre>',
})
const PermissionGuardStub = defineComponent({
  name: 'PermissionGuard',
  template: '<div><slot /></div>',
})
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const ElButtonStub = defineComponent({
  props: { disabled: Boolean, loading: Boolean },
  emits: ['click'],
  template:
    '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
})

beforeEach(() => {
  getPluginConfigMock.mockReset()
  updatePluginConfigMock.mockReset()
})

describe('ConfigView installation isolation', () => {
  it('does not reuse schema/config or accept a stale response across same-plugin instances', async () => {
    const first = deferred<PluginConfigResponse>()
    const second = deferred<PluginConfigResponse>()
    getPluginConfigMock.mockImplementation((installationId) =>
      installationId === 'installation-a' ? first.promise : second.promise,
    )
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ConfigView, {
      props: { installationId: 'installation-a' },
      global: {
        plugins: [pinia],
        stubs: {
          JsonEditor: JsonEditorStub,
          PermissionGuard: PermissionGuardStub,
          PluginSchemaForm: true,
          ElButton: true,
          ElSkeleton: true,
          ElAlert: true,
          ElTabs: true,
          ElTabPane: true,
        },
      },
    })

    await wrapper.setProps({ installationId: 'installation-b' })
    second.resolve({
      installationId: 'installation-b',
      pluginId: 'same.plugin',
      configJson: '{"owner":"B"}',
      schemaJson: null,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="json-editor"]').text()).toContain('"B"')

    first.resolve({
      installationId: 'installation-a',
      pluginId: 'same.plugin',
      configJson: '{"owner":"A"}',
      schemaJson: null,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="json-editor"]').text()).toContain('"B"')
    expect(wrapper.text()).not.toContain('"A"')
    expect(getPluginConfigMock).toHaveBeenCalledWith('installation-a')
    expect(getPluginConfigMock).toHaveBeenCalledWith('installation-b')
  })
})

describe('ConfigView recursive schema save', () => {
  it('submits the exact recursive configJson while preserving unknown fields', async () => {
    const schemaJson = JSON.stringify({
      fields: [
        {
          name: 'products',
          label: '商品列表',
          type: 'OBJECT_LIST',
          itemSchema: {
            fields: [
              { name: 'productName', label: '商品名', type: 'TEXT' },
              {
                name: 'variants',
                label: '规格列表',
                type: 'OBJECT_LIST',
                itemSchema: {
                  fields: [
                    { name: 'name', label: '规格名', type: 'TEXT' },
                    { name: 'stock', label: '库存', type: 'NUMBER' },
                  ],
                },
              },
            ],
          },
        },
      ],
    })
    getPluginConfigMock.mockResolvedValue({
      installationId: 'installation-a',
      pluginId: 'demo.plugin',
      configJson: JSON.stringify({ untouched: 'keep', products: [] }),
      schemaJson,
    })
    updatePluginConfigMock.mockResolvedValue({
      installationId: 'installation-a',
      pluginId: 'demo.plugin',
      configJson: '{}',
      schemaJson,
    })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)

    const recursiveValue = {
      products: [
        {
          productName: '商品A',
          variants: [
            { name: '红色', stock: 10 },
            { name: '蓝色', stock: 8 },
          ],
        },
      ],
    }
    const PluginSchemaFormStub = defineComponent({
      props: { modelValue: { type: Object, default: () => ({}) } },
      emits: ['update:modelValue', 'valid-change'],
      methods: {
        applyRecursiveValue() {
          this.$emit('update:modelValue', recursiveValue)
          this.$emit('valid-change', true)
        },
      },
      template:
        '<button data-testid="apply-recursive-config" @click="applyRecursiveValue">应用递归值</button>',
    })
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ConfigView, {
      props: { installationId: 'installation-a' },
      global: {
        plugins: [pinia],
        stubs: {
          JsonEditor: JsonEditorStub,
          PermissionGuard: PermissionGuardStub,
          PluginSchemaForm: PluginSchemaFormStub,
          ElButton: ElButtonStub,
          ElSkeleton: true,
          ElAlert: true,
          ElTabs: SlotStub,
          ElTabPane: SlotStub,
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="apply-recursive-config"]').trigger('click')
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存配置')
    if (!saveButton) throw new Error('Save config button not found')
    await saveButton.trigger('click')
    await flushPromises()

    expect(updatePluginConfigMock).toHaveBeenCalledTimes(1)
    const [installationId, configJson] = updatePluginConfigMock.mock.calls[0]
    expect(installationId).toBe('installation-a')
    expect(JSON.parse(configJson)).toEqual({ untouched: 'keep', ...recursiveValue })
  })
})
