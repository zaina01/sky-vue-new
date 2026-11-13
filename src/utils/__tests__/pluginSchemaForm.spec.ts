import { describe, expect, it } from 'vitest'

import type { PluginFieldSchema } from '@/types/plugins'
import {
  buildSchemaModel,
  createSchemaObjectListRow,
  formatSchemaPath,
  getSchemaRowKey,
  mergeAccountModel,
  mergeConfigModel,
  resolveAccountSchemaResponse,
  resolveConfigSchema,
  stringifyJsonObject,
  updateSchemaValueAtPath,
  validateSchemaModel,
  type SchemaModel,
} from '@/utils/pluginSchemaForm'

const recursiveFields: PluginFieldSchema[] = [
  {
    name: 'products',
    label: '商品列表',
    type: 'OBJECT_LIST',
    required: true,
    itemSchema: {
      fields: [
        { name: 'productName', label: '商品名', type: 'TEXT', required: true },
        {
          name: 'variants',
          label: '规格列表',
          type: 'OBJECT_LIST',
          required: true,
          itemSchema: {
            fields: [
              { name: 'enabled', label: '启用', type: 'SWITCH' },
              { name: 'name', label: '规格名', type: 'TEXT', required: true },
              { name: 'stock', label: '库存', type: 'NUMBER', required: true },
              {
                name: 'warehouses',
                label: '仓库列表',
                type: 'OBJECT_LIST',
                itemSchema: {
                  fields: [{ name: 'code', label: '仓库编码', type: 'TEXT', required: true }],
                },
              },
            ],
          },
        },
      ],
    },
  },
]

function deepObjectListSchema(levels: number, level = 1): PluginFieldSchema {
  return {
    name: `level${level}`,
    label: `第 ${level} 层`,
    type: 'OBJECT_LIST',
    itemSchema: {
      fields:
        level === levels
          ? [{ name: 'value', label: '值', type: 'TEXT' }]
          : [deepObjectListSchema(levels, level + 1)],
    },
  }
}

function deepObjectListValue(levels: number, level = 1): SchemaModel {
  return {
    [`level${level}`]: [
      level === levels ? { value: 'ok' } : deepObjectListValue(levels, level + 1),
    ],
  }
}

describe('plugin schema recursive normalization and model helpers', () => {
  it('normalizes recursive config and account schemas at every level', () => {
    const schemaJson = JSON.stringify({
      fields: [
        {
          name: 'products',
          label: '商品',
          type: 'object_list',
          itemSchema: {
            fields: [
              {
                name: 'variants',
                label: '规格',
                type: 'OBJECT_LIST',
                itemSchema: {
                  fields: [
                    { name: 'enabled', label: '启用', type: 'boolean' },
                    { name: 'kind', label: '类型', type: 'select', options: ['A', 'B'] },
                  ],
                },
              },
            ],
          },
        },
      ],
    })

    const configSchema = resolveConfigSchema({
      installationId: 'installation-a',
      pluginId: 'demo.plugin',
      configJson: '{}',
      schemaJson,
    })
    const accountSchema = resolveAccountSchemaResponse({
      installationId: 'installation-a',
      pluginId: 'demo.plugin',
      schemaJson,
    })

    const configChildren = configSchema?.fields[0].itemSchema?.fields?.[0].itemSchema?.fields
    const accountChildren = accountSchema?.fields[0].itemSchema?.fields?.[0].itemSchema?.fields
    expect(configChildren?.[0].type).toBe('SWITCH')
    expect(accountChildren?.[0].type).toBe('SWITCH')
    expect(configChildren?.[1].options).toEqual([
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ])
  })

  it('uses full paths for immutable updates and keeps row UI keys out of JSON', () => {
    const model = buildSchemaModel(
      recursiveFields,
      {
        products: [
          { productName: 'A', variants: [] },
          { productName: 'B', variants: [] },
        ],
      },
      'edit',
    )
    const secondRow = (model.products as SchemaModel[])[1]
    const secondKey = getSchemaRowKey(secondRow)
    const updated = updateSchemaValueAtPath(model, ['products', 1, 'productName'], 'B2')
    const updatedSecondRow = (updated.products as SchemaModel[])[1]

    expect(formatSchemaPath(['products', 1, 'variants', 0, 'name'])).toBe(
      'products[1].variants[0].name',
    )
    expect(getSchemaRowKey(updatedSecondRow)).toBe(secondKey)
    expect(JSON.parse(stringifyJsonObject(updated))).toEqual({
      products: [
        { productName: 'A', variants: [] },
        { productName: 'B2', variants: [] },
      ],
    })
  })

  it('creates rows with recursive defaults and serializes exact nested config data', () => {
    const row = createSchemaObjectListRow(recursiveFields[0].itemSchema?.fields || [])
    expect(row).toEqual({ productName: '', variants: [] })

    const original = {
      rootUnknown: 'keep-root',
      products: [
        {
          productName: '商品A',
          rowUnknown: 'keep-row',
          variants: [
            {
              enabled: true,
              name: '红色',
              stock: 10,
              warehouses: [{ code: 'WH-A', nestedUnknown: 1 }],
            },
          ],
        },
      ],
    }
    let model = buildSchemaModel(recursiveFields, original, 'edit')
    model = updateSchemaValueAtPath(model, ['products', 0, 'variants', 0, 'stock'], 12)
    model = updateSchemaValueAtPath(
      model,
      ['products', 0, 'variants', 0, 'warehouses'],
      [{ code: 'WH-B' }],
    )

    expect(mergeConfigModel(original, recursiveFields, model)).toEqual({
      rootUnknown: 'keep-root',
      products: [
        {
          productName: '商品A',
          rowUnknown: 'keep-row',
          variants: [
            {
              enabled: true,
              name: '红色',
              stock: 12,
              warehouses: [{ code: 'WH-B' }],
            },
          ],
        },
      ],
    })
  })
})

describe('plugin account recursive merge semantics', () => {
  it('keeps nested readonly and sensitive values attached to the correct row after deletion', () => {
    const fields: PluginFieldSchema[] = [
      {
        name: 'profiles',
        label: '账号资料',
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: [
            { name: 'name', label: '名称', type: 'TEXT' },
            { name: 'externalId', label: '外部 ID', type: 'TEXT', readonly: true },
            { name: 'secret', label: '密钥', type: 'PASSWORD', sensitive: true, required: true },
            {
              name: 'tokens',
              label: '令牌列表',
              type: 'OBJECT_LIST',
              itemSchema: {
                fields: [
                  { name: 'tokenId', label: '令牌 ID', type: 'TEXT', readonly: true },
                  { name: 'token', label: '令牌', type: 'PASSWORD', sensitive: true },
                ],
              },
            },
          ],
        },
      },
    ]
    const original = {
      unknownRoot: 'keep',
      profiles: [
        {
          name: 'first',
          externalId: 'readonly-first',
          secret: '******',
          tokens: [{ tokenId: 'token-first', token: '******' }],
        },
        {
          name: 'second',
          externalId: 'readonly-second',
          secret: '********',
          tokens: [{ tokenId: 'token-second', token: '********' }],
        },
      ],
    }
    let model = buildSchemaModel(fields, original, 'edit')
    model = updateSchemaValueAtPath(model, ['profiles'], (model.profiles as SchemaModel[]).slice(1))
    model = updateSchemaValueAtPath(model, ['profiles', 0, 'name'], 'second-updated')

    expect(mergeAccountModel(original, fields, model, 'edit')).toEqual({
      unknownRoot: 'keep',
      profiles: [
        {
          name: 'second-updated',
          externalId: 'readonly-second',
          secret: '********',
          tokens: [{ tokenId: 'token-second', token: '********' }],
        },
      ],
    })
  })
})

describe('plugin schema recursive validation', () => {
  it('validates required arrays and required children at every visible level', () => {
    const rootErrors = validateSchemaModel(
      recursiveFields,
      { products: [] },
      {
        mode: 'config',
        submitMode: 'edit',
      },
    )
    expect(rootErrors.get('products')).toContain('商品列表')

    const nestedErrors = validateSchemaModel(
      recursiveFields,
      { products: [{ productName: '', variants: [] }] },
      { mode: 'config', submitMode: 'edit' },
    )
    expect(nestedErrors.get('products[0].productName')).toContain('商品名')
    expect(nestedErrors.get('products[0].variants')).toContain('规格列表')

    const deepestErrors = validateSchemaModel(
      recursiveFields,
      {
        products: [
          {
            productName: '商品A',
            variants: [{ enabled: true, name: '', stock: undefined, warehouses: [{}] }],
          },
        ],
      },
      { mode: 'config', submitMode: 'edit' },
    )
    expect(deepestErrors.has('products[0].variants[0].name')).toBe(true)
    expect(deepestErrors.has('products[0].variants[0].stock')).toBe(true)
    expect(deepestErrors.has('products[0].variants[0].warehouses[0].code')).toBe(true)
  })

  it('uses the current row sibling for boolean visibleWhen and preserves hidden values', () => {
    const fields: PluginFieldSchema[] = [
      {
        name: 'rows',
        label: '行',
        type: 'OBJECT_LIST',
        itemSchema: {
          fields: [
            { name: 'enabled', label: '启用', type: 'SWITCH' },
            {
              name: 'secret',
              label: '条件字段',
              type: 'TEXT',
              required: true,
              visibleWhen: { field: 'enabled', equals: true },
            },
          ],
        },
      },
    ]
    const model = {
      rows: [
        { enabled: false, secret: 'hidden-but-kept' },
        { enabled: true, secret: '' },
      ],
    }
    const errors = validateSchemaModel(fields, model, { mode: 'config', submitMode: 'edit' })

    expect(errors.has('rows[0].secret')).toBe(false)
    expect(errors.has('rows[1].secret')).toBe(true)
    expect(mergeConfigModel({}, fields, model)).toEqual(model)
  })

  it('accepts 16 levels and reports missing, malformed, and 17th-level schemas', () => {
    const missingFields = [{ name: 'missing', label: '缺失', type: 'OBJECT_LIST' as const }]
    const malformedFields = [
      {
        name: 'malformed',
        label: '错误',
        type: 'OBJECT_LIST' as const,
        itemSchema: { fields: 'not-an-array' },
      },
    ] as unknown as PluginFieldSchema[]
    expect(
      validateSchemaModel(
        missingFields,
        { missing: [] },
        { mode: 'config', submitMode: 'edit' },
      ).get('missing'),
    ).toContain('缺少合法 itemSchema')
    expect(
      validateSchemaModel(
        malformedFields,
        { malformed: [] },
        { mode: 'config', submitMode: 'edit' },
      ).get('malformed'),
    ).toContain('必须是数组')

    const legalFields = [deepObjectListSchema(16)]
    expect(
      validateSchemaModel(legalFields, deepObjectListValue(16), {
        mode: 'config',
        submitMode: 'edit',
      }).size,
    ).toBe(0)

    const tooDeepFields = [deepObjectListSchema(17)]
    const tooDeepErrors = validateSchemaModel(
      tooDeepFields,
      { level1: [] },
      {
        mode: 'config',
        submitMode: 'edit',
      },
    )
    expect([...tooDeepErrors.values()][0]).toContain('超过最大 16 层')
  })
})
