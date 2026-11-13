import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElForm, ElFormItem, ElInput, ElSwitch } from 'element-plus'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import PluginSchemaForm from '@/components/plugins/PluginSchemaForm.vue'
import type {
  PluginAccountSchemaField,
  PluginConfigSchemaField,
  PluginFieldSchema,
} from '@/types/plugins'

const objectField: PluginConfigSchemaField = {
  name: 'windows',
  label: '时间窗口',
  type: 'OBJECT_LIST',
  itemSchema: {
    fields: [
      { name: 'startDate', label: '开始日期', type: 'DATE' },
      { name: 'startTime', label: '开始时间', type: 'TIME' },
      { name: 'name', label: '名称', type: 'TEXT' },
      { name: 'metadata', label: '扩展参数', type: 'MAP' },
    ],
  },
}

const configFields: PluginConfigSchemaField[] = [
  { name: 'runAt', label: '执行时间', type: 'DATETIME' },
  { name: 'retries', label: '重试次数', type: 'NUMBER' },
  { name: 'enabled', label: '启用', type: 'SWITCH' },
  { name: 'endpoint', label: '目标地址', type: 'TEXT' },
  { name: 'tags', label: '标签', type: 'LIST' },
  objectField,
]

const configModel = {
  runAt: '2026-08-01 09:30:00',
  retries: 3,
  enabled: true,
  endpoint: 'https://example.test',
  tags: ['production'],
  windows: [
    {
      startDate: '2026-08-01',
      startTime: '09:30:00',
      name: 'morning',
      metadata: { region: 'cn' },
    },
  ],
}

function mountForm(
  fields: Array<PluginConfigSchemaField | PluginAccountSchemaField> = configFields,
  modelValue: Record<string, unknown> = configModel,
  mode: 'config' | 'account' = 'config',
  extraProps: { submitMode?: 'create' | 'edit'; accountIdField?: string } = {},
) {
  return mount(PluginSchemaForm, {
    props: { fields, modelValue, mode, ...extraProps },
    global: {
      plugins: [ElementPlus],
      stubs: {
        teleport: true,
        transition: false,
      },
    },
  })
}

function formItemByLabel(wrapper: VueWrapper, label: string) {
  const item = wrapper
    .findAllComponents(ElFormItem)
    .find((candidate) => candidate.props('label') === label)
  if (!item) throw new Error(`Form item not found: ${label}`)
  return item
}

function lastModelUpdate(wrapper: VueWrapper) {
  const updates = wrapper.emitted('update:modelValue')
  if (!updates?.length) throw new Error('Expected update:modelValue to be emitted')
  return updates.at(-1)?.[0] as Record<string, unknown>
}

function objectListAddButton(wrapper: VueWrapper, path: string) {
  const button = wrapper
    .get(`[data-object-list-path="${path}"]`)
    .findAll('button')
    .filter((candidate) => candidate.text().trim() === '添加一项')
    .at(-1)
  if (!button) throw new Error(`Object-list add button not found: ${path}`)
  return button
}

function objectListRows(wrapper: VueWrapper, path: string) {
  return wrapper.findAll(`[data-object-list-row-path="${path}"]`)
}

function objectListRowDeleteButton(wrapper: VueWrapper, path: string, index: number) {
  const row = objectListRows(wrapper, path)[index]
  if (!row) throw new Error(`Object-list row not found: ${path}[${index}]`)
  return row.get('.plugin-schema-form__object-row-header button')
}

describe('PluginSchemaForm layout', () => {
  it('marks compact and wide fields and renders object children in a lightweight grid', () => {
    const wrapper = mountForm()

    expect(wrapper.find('.plugin-schema-form__grid').exists()).toBe(true)
    expect(formItemByLabel(wrapper, '执行时间').classes()).toContain(
      'plugin-schema-form__field--compact',
    )
    expect(formItemByLabel(wrapper, '重试次数').classes()).toContain(
      'plugin-schema-form__field--compact',
    )
    expect(formItemByLabel(wrapper, '目标地址').classes()).not.toContain(
      'plugin-schema-form__field--compact',
    )
    expect(formItemByLabel(wrapper, '标签').classes()).toContain('plugin-schema-form__field--wide')
    expect(formItemByLabel(wrapper, '时间窗口').classes()).toContain(
      'plugin-schema-form__field--wide',
    )

    const objectRow = wrapper.get('.plugin-schema-form__object-row')
    expect(objectRow.element.tagName).toBe('SECTION')
    expect(objectRow.find('.plugin-schema-form__object-fields--grid').exists()).toBe(true)
    expect(formItemByLabel(wrapper, '开始日期').classes()).toContain(
      'plugin-schema-form__field--compact',
    )
    expect(formItemByLabel(wrapper, '扩展参数').classes()).toContain(
      'plugin-schema-form__field--wide',
    )
  })

  it('uses top labels and wide complex fields in the account grid, including object children', () => {
    const accountFields: PluginAccountSchemaField[] = [
      { name: 'expiresAt', label: '过期时间', type: 'DATETIME' },
      objectField,
    ]
    const wrapper = mountForm(
      accountFields,
      { expiresAt: '2026-08-01 09:30:00', windows: configModel.windows },
      'account',
    )

    expect(wrapper.getComponent(ElForm).props('labelPosition')).toBe('top')
    expect(wrapper.find('.plugin-schema-form--account .plugin-schema-form__grid').exists()).toBe(
      true,
    )
    expect(formItemByLabel(wrapper, '过期时间').classes()).toContain(
      'plugin-schema-form__field--compact',
    )
    expect(formItemByLabel(wrapper, '时间窗口').classes()).toContain(
      'plugin-schema-form__field--wide',
    )
    expect(formItemByLabel(wrapper, '扩展参数').classes()).toContain(
      'plugin-schema-form__field--wide',
    )
    expect(wrapper.find('.plugin-schema-form__object-fields--account').exists()).toBe(true)
  })

  it('keeps full long labels and required errors, showing the sensitive hint only when editing', async () => {
    const longLabel = '网页User-Agent（navigator.userAgent）' + '连续长标题'.repeat(20)
    const fields: PluginAccountSchemaField[] = [
      { name: 'userAgent', label: longLabel, type: 'TEXT', required: true },
      { name: 'cookie', label: 'Cookie', type: 'PASSWORD', sensitive: true, required: true },
    ]
    const wrapper = mountForm(fields, {}, 'account')
    await nextTick()

    expect(formItemByLabel(wrapper, longLabel).get('.el-form-item__label').text()).toBe(longLabel)
    await expect.poll(() => wrapper.findAll('.el-form-item__error').length).toBe(2)
    expect(wrapper.text()).toContain(`请输入${longLabel}`)
    expect(wrapper.text()).not.toContain('敏感字段留空表示不修改')
    expect(wrapper.emitted('valid-change')?.at(-1)?.[0]).toBe(false)

    await wrapper.setProps({ submitMode: 'edit' })
    expect(wrapper.text()).toContain('敏感字段留空表示不修改')
    expect(formItemByLabel(wrapper, 'Cookie').getComponent(ElInput).props('placeholder')).toBe(
      '留空表示不修改',
    )
  })

  it('preserves object child updates and row add/remove payloads', async () => {
    const fields: PluginConfigSchemaField[] = [
      {
        name: 'entries',
        label: '对象配置',
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: [{ name: 'name', label: '名称', type: 'TEXT' }],
        },
      },
    ]
    const wrapper = mountForm(fields, { entries: [{ name: 'before' }] })

    wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'after')
    await nextTick()
    expect(lastModelUpdate(wrapper)).toEqual({ entries: [{ name: 'after' }] })

    await wrapper.setProps({ modelValue: { entries: [{ name: 'after' }] } })
    const addButton = wrapper.findAll('button').find((button) => button.text() === '添加一项')
    if (!addButton) throw new Error('Add object row button not found')
    await addButton.trigger('click')

    const addedModel = lastModelUpdate(wrapper)
    expect(addedModel).toEqual({ entries: [{ name: 'after' }, { name: '' }] })

    await wrapper.setProps({ modelValue: addedModel })
    const removeButton = wrapper.findAll('button').find((button) => button.text() === '删除')
    if (!removeButton) throw new Error('Remove object row button not found')
    await removeButton.trigger('click')
    expect(lastModelUpdate(wrapper)).toEqual({ entries: [{ name: '' }] })
  })
})

const recursiveFields: PluginFieldSchema[] = [
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
              { name: 'enabled', label: '启用规格', type: 'SWITCH' },
              { name: 'name', label: '规格名', type: 'TEXT' },
              { name: 'stock', label: '库存', type: 'NUMBER' },
              {
                name: 'warehouses',
                label: '仓库列表',
                type: 'OBJECT_LIST',
                itemSchema: {
                  fields: [{ name: 'code', label: '仓库编码', type: 'TEXT' }],
                },
              },
            ],
          },
        },
      ],
    },
  },
]

describe('PluginSchemaForm recursive OBJECT_LIST behavior', () => {
  it('renders three levels and supports editing, adding, and deleting at every level', async () => {
    let model: Record<string, unknown> = {
      products: [
        {
          productName: '商品A',
          variants: [
            {
              enabled: true,
              name: '红色',
              stock: 10,
              warehouses: [{ code: 'WH-A' }],
            },
          ],
        },
      ],
    }
    const wrapper = mountForm(recursiveFields, model)

    expect(
      wrapper.find('[data-field-path="products[0].variants[0].warehouses[0].code"]').exists(),
    ).toBe(true)
    expect(wrapper.findAll('.plugin-schema-form__object-row')).toHaveLength(3)

    formItemByLabel(wrapper, '商品名').getComponent(ElInput).vm.$emit('update:modelValue', '商品A2')
    await nextTick()
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })

    formItemByLabel(wrapper, '规格名').getComponent(ElInput).vm.$emit('update:modelValue', '红色-L')
    await nextTick()
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })

    formItemByLabel(wrapper, '仓库编码')
      .getComponent(ElInput)
      .vm.$emit('update:modelValue', 'WH-A2')
    await nextTick()
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })

    expect(model).toEqual({
      products: [
        {
          productName: '商品A2',
          variants: [
            {
              enabled: true,
              name: '红色-L',
              stock: 10,
              warehouses: [{ code: 'WH-A2' }],
            },
          ],
        },
      ],
    })

    await objectListAddButton(wrapper, 'products[0].variants[0].warehouses').trigger('click')
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect(
      ((model.products as Record<string, unknown>[])[0].variants as Record<string, unknown>[])[0]
        .warehouses as unknown[],
    ).toHaveLength(2)

    await objectListAddButton(wrapper, 'products[0].variants').trigger('click')
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect((model.products as Record<string, unknown>[])[0].variants).toEqual([
      {
        enabled: true,
        name: '红色-L',
        stock: 10,
        warehouses: [{ code: 'WH-A2' }, { code: '' }],
      },
      { enabled: false, name: '', stock: undefined, warehouses: [] },
    ])

    await objectListAddButton(wrapper, 'products').trigger('click')
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect((model.products as Record<string, unknown>[])[1]).toEqual({
      productName: '',
      variants: [],
    })

    await objectListRowDeleteButton(wrapper, 'products[0].variants[0].warehouses', 0).trigger(
      'click',
    )
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect(
      ((model.products as Record<string, unknown>[])[0].variants as Record<string, unknown>[])[0]
        .warehouses as unknown[],
    ).toEqual([{ code: '' }])

    await objectListRowDeleteButton(wrapper, 'products[0].variants', 0).trigger('click')
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect((model.products as Record<string, unknown>[])[0].variants).toEqual([
      { enabled: false, name: '', stock: undefined, warehouses: [] },
    ])

    const secondProductKey = objectListRows(wrapper, 'products')[1].attributes('data-row-key')
    await objectListRowDeleteButton(wrapper, 'products', 0).trigger('click')
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect(model.products as unknown[]).toHaveLength(1)
    expect(objectListRows(wrapper, 'products')[0].attributes('data-row-key')).toBe(secondProductKey)
    expect(JSON.stringify(model)).not.toContain('plugin-schema-row')
  })

  it('evaluates visibleWhen against each current row and retains hidden values', async () => {
    const fields: PluginFieldSchema[] = [
      {
        name: 'rows',
        label: '条件行',
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: [
            { name: 'enabled', label: '启用', type: 'SWITCH' },
            {
              name: 'secret',
              label: '条件值',
              type: 'TEXT',
              required: true,
              visibleWhen: { field: 'enabled', equals: true },
            },
          ],
        },
      },
    ]
    let model: Record<string, unknown> = {
      rows: [
        { enabled: false, secret: '保留值' },
        { enabled: true, secret: '显示值' },
      ],
    }
    const wrapper = mountForm(fields, model)

    expect(wrapper.find('[data-field-path="rows[0].secret"]').exists()).toBe(false)
    expect(wrapper.find('[data-field-path="rows[1].secret"]').exists()).toBe(true)

    wrapper.findAllComponents(ElSwitch)[0].vm.$emit('update:modelValue', true)
    await nextTick()
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect(wrapper.find('[data-field-path="rows[0].secret"]').exists()).toBe(true)
    expect((model.rows as Record<string, unknown>[])[0].secret).toBe('保留值')

    wrapper.findAllComponents(ElSwitch)[0].vm.$emit('update:modelValue', false)
    await nextTick()
    model = lastModelUpdate(wrapper)
    await wrapper.setProps({ modelValue: model })
    expect(wrapper.find('[data-field-path="rows[0].secret"]').exists()).toBe(false)
    expect((model.rows as Record<string, unknown>[])[0].secret).toBe('保留值')
  })

  it('applies nested readonly, ancestor readonly, sensitive, and PASSWORD account behavior', () => {
    const fields: PluginFieldSchema[] = [
      {
        name: 'profiles',
        label: '资料',
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: [
            { name: 'readonlyValue', label: '只读值', type: 'TEXT', readonly: true },
            {
              name: 'secret',
              label: '敏感值',
              type: 'PASSWORD',
              sensitive: true,
              required: true,
            },
            { name: 'password', label: '密码值', type: 'PASSWORD' },
          ],
        },
      },
      {
        name: 'lockedRows',
        label: '锁定行',
        type: 'OBJECT_LIST',
        readonly: true,
        itemSchema: {
          fields: [{ name: 'name', label: '锁定名称', type: 'TEXT' }],
        },
      },
    ]
    const wrapper = mountForm(
      fields,
      {
        profiles: [{ readonlyValue: 'fixed', secret: '', password: 'plain-password' }],
        lockedRows: [{ name: 'locked' }],
      },
      'account',
      { submitMode: 'edit' },
    )

    expect(formItemByLabel(wrapper, '只读值').getComponent(ElInput).props('disabled')).toBe(true)
    expect(formItemByLabel(wrapper, '敏感值').getComponent(ElInput).props()).toMatchObject({
      type: 'password',
      showPassword: true,
      placeholder: '留空表示不修改',
      disabled: false,
    })
    expect(formItemByLabel(wrapper, '密码值').getComponent(ElInput).props()).toMatchObject({
      type: 'password',
      showPassword: true,
    })
    expect(formItemByLabel(wrapper, '锁定名称').getComponent(ElInput).props('disabled')).toBe(true)
    expect(objectListAddButton(wrapper, 'lockedRows').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('valid-change')?.at(-1)?.[0]).toBe(true)
  })

  it('shows friendly errors for malformed and over-depth schemas without recursing forever', () => {
    const malformed = [
      {
        name: 'rows',
        label: '错误行',
        type: 'OBJECT_LIST',
        itemSchema: { fields: 'invalid' },
      },
    ] as unknown as PluginFieldSchema[]
    const malformedWrapper = mountForm(malformed, { rows: [] })
    expect(malformedWrapper.text()).toContain('itemSchema.fields 必须是数组')
    expect(malformedWrapper.emitted('valid-change')?.at(-1)?.[0]).toBe(false)

    function deepField(level: number): PluginFieldSchema {
      return {
        name: `level${level}`,
        label: `第 ${level} 层`,
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: level === 17 ? [] : [deepField(level + 1)],
        },
      }
    }
    const deepWrapper = mountForm([deepField(1)], { level1: [] })
    expect(deepWrapper.text()).toContain('超过最大 16 层')
    expect(deepWrapper.findAll('.plugin-schema-form__object-row')).toHaveLength(0)
    expect(deepWrapper.emitted('valid-change')?.at(-1)?.[0]).toBe(false)
  })
})
