import { toRaw } from 'vue'

import type {
  PluginAccountDetail,
  PluginAccountSchema,
  PluginAccountSchemaResponse,
  PluginConfig,
  PluginConfigSchema,
  PluginConfigSchemaField,
  PluginFieldSchema,
  PluginSchemaOption,
  PluginSchemaPrimitiveValue,
  PluginSchemaVisibleWhen,
} from '@/types/plugins'

export const PLUGIN_SCHEMA_MAX_OBJECT_LIST_DEPTH = 16

export type SchemaModel = Record<string, unknown>
export type SchemaPathSegment = string | number
export type SchemaPath = SchemaPathSegment[]

export interface SchemaValidationOptions {
  mode: 'config' | 'account'
  submitMode: 'create' | 'edit'
}

interface SchemaRowMetadata {
  key: string
  hasOriginal: boolean
  original?: SchemaModel
}

const schemaRowMetadata = new WeakMap<object, SchemaRowMetadata>()
let schemaRowSequence = 0

function isRecord(value: unknown): value is SchemaModel {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function own(object: SchemaModel, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function rawObject<T extends object>(value: T) {
  return toRaw(value)
}

function registerSchemaRow(row: SchemaModel, original?: SchemaModel, hasOriginal = false) {
  const rawRow = rawObject(row)
  const current = schemaRowMetadata.get(rawRow)
  schemaRowMetadata.set(rawRow, {
    key: current?.key || `plugin-schema-row-${++schemaRowSequence}`,
    hasOriginal: current?.hasOriginal ?? hasOriginal,
    original: current?.original ?? original,
  })
  return row
}

function transferSchemaRowMetadata(source: unknown, target: unknown) {
  if (!isRecord(source) || !isRecord(target)) return
  const metadata = schemaRowMetadata.get(rawObject(source))
  if (metadata) schemaRowMetadata.set(rawObject(target), metadata)
}

function getSchemaRowMetadata(row: SchemaModel) {
  return schemaRowMetadata.get(rawObject(row))
}

export function getSchemaRowKey(row: SchemaModel) {
  const rawRow = rawObject(row)
  const metadata = schemaRowMetadata.get(rawRow)
  if (metadata) return metadata.key
  registerSchemaRow(row)
  return schemaRowMetadata.get(rawRow)!.key
}

export function parseJsonObject(json?: string) {
  if (!json?.trim()) return {}
  const value = JSON.parse(json) as unknown
  return isRecord(value) ? value : {}
}

export function safeParseJsonObject(json?: string) {
  try {
    return parseJsonObject(json)
  } catch {
    return {}
  }
}

export function stringifyJsonObject(value: SchemaModel) {
  return JSON.stringify(value, null, 2)
}

export function isMaskedSensitiveValue(value: unknown) {
  return typeof value === 'string' && /^\*+$/.test(value.trim())
}

export function resolveConfigSchema(config: PluginConfig): PluginConfigSchema | undefined {
  return (
    normalizeConfigSchema(config.schema) ||
    normalizeConfigSchema(config.configSchema) ||
    parseSchemaJson(config.schemaJson)
  )
}

function parseSchemaJson(schemaJson?: string | PluginConfigSchema | null) {
  if (!schemaJson) return undefined
  if (typeof schemaJson !== 'string') return normalizeConfigSchema(schemaJson)
  if (!schemaJson.trim()) return undefined
  try {
    return normalizeConfigSchema(JSON.parse(schemaJson))
  } catch {
    return undefined
  }
}

function normalizeConfigSchema(value: unknown): PluginConfigSchema | undefined {
  if (!isRecord(value)) return undefined
  const schema = value as Partial<PluginConfigSchema>
  if (!Array.isArray(schema.fields) || !schema.fields.length) return undefined
  return {
    ...schema,
    fields: normalizeSchemaFields(schema.fields),
  }
}

export function resolveAccountSchema(
  account?: PluginAccountDetail,
): PluginAccountSchema | undefined {
  return normalizeAccountSchema(account?.schema) || normalizeAccountSchema(account?.accountSchema)
}

export function resolveAccountSchemaResponse(
  response?: PluginAccountSchemaResponse,
): PluginAccountSchema | undefined {
  const direct =
    normalizeAccountSchema(response?.schema) || normalizeAccountSchema(response?.accountSchema)
  if (direct) return direct
  if (!response?.schemaJson) return undefined
  if (typeof response.schemaJson !== 'string') return normalizeAccountSchema(response.schemaJson)
  if (!response.schemaJson.trim()) return undefined
  try {
    return normalizeAccountSchema(JSON.parse(response.schemaJson))
  } catch {
    return undefined
  }
}

function normalizeAccountSchema(value: unknown): PluginAccountSchema | undefined {
  if (!isRecord(value)) return undefined
  const schema = value as Partial<PluginAccountSchema>
  if (!Array.isArray(schema.fields) || !schema.fields.length) return undefined
  return {
    ...schema,
    fields: normalizeSchemaFields(schema.fields),
  }
}

function normalizeSchemaFields(fields: unknown[], objectListDepth = 0): PluginFieldSchema[] {
  return fields.map((field): PluginFieldSchema => {
    const schemaField = field as PluginFieldSchema
    const normalized: PluginFieldSchema = {
      ...schemaField,
      type: normalizeSchemaFieldType(schemaField.type),
      options: normalizeSchemaFieldOptions(schemaField.options),
      visibleWhen: normalizeSchemaVisibleWhen(schemaField.visibleWhen),
    }

    if (normalized.type !== 'OBJECT_LIST') return normalized

    const currentDepth = objectListDepth + 1
    if (currentDepth > PLUGIN_SCHEMA_MAX_OBJECT_LIST_DEPTH) {
      return { ...normalized, itemSchema: undefined }
    }

    const itemSchema = (schemaField as { itemSchema?: unknown }).itemSchema
    if (!isRecord(itemSchema)) return normalized

    if (!Array.isArray(itemSchema.fields)) {
      return {
        ...normalized,
        itemSchema: { ...itemSchema, fields: itemSchema.fields as never },
      }
    }

    return {
      ...normalized,
      itemSchema: {
        ...itemSchema,
        fields: normalizeSchemaFields(itemSchema.fields, currentDepth),
      },
    }
  })
}

function normalizeSchemaFieldOptions(options: unknown): PluginSchemaOption[] {
  if (!Array.isArray(options)) return []
  return options.map((option) => {
    if (isRecord(option)) {
      return {
        label:
          option.label === undefined || option.label === null ? undefined : String(option.label),
        value: option.value as string | number | boolean,
      }
    }
    return {
      label: String(option),
      value: option as string | number | boolean,
    }
  })
}

function normalizeSchemaVisibleWhen(value: unknown): PluginSchemaVisibleWhen | undefined {
  if (!isRecord(value)) return undefined
  const field = typeof value.field === 'string' ? value.field.trim() : ''
  if (!field) return undefined

  if (own(value, 'equals')) {
    return {
      field,
      equals: value.equals as PluginSchemaPrimitiveValue,
    }
  }

  if (Array.isArray(value.in)) {
    return {
      field,
      in: value.in as PluginSchemaPrimitiveValue[],
    }
  }

  return undefined
}

function normalizeSchemaFieldType(type: unknown) {
  const normalized = String(type).toUpperCase()
  if (normalized === 'BOOLEAN') return 'SWITCH'
  return normalized as PluginFieldSchema['type']
}

export function isFieldVisible(field: PluginFieldSchema, values: SchemaModel) {
  if (!field.visibleWhen) return true
  const condition = field.visibleWhen
  const controlValue = values[condition.field]

  if ('equals' in condition) {
    return valueMatchesCondition(controlValue, condition.equals)
  }

  return condition.in.some((item) => valueMatchesCondition(controlValue, item))
}

function valueMatchesCondition(value: unknown, conditionValue: PluginSchemaPrimitiveValue) {
  if (Array.isArray(value)) return value.includes(conditionValue)
  return value === conditionValue
}

export function visibleSchemaFields<T extends PluginFieldSchema>(fields: T[], values: SchemaModel) {
  return fields.filter((field) => isFieldVisible(field, values))
}

export function resolveAccountIdField(schema?: PluginAccountSchema) {
  return schema?.accountIdField || schema?.fields.find((field) => field.accountId)?.name || ''
}

export function schemaFieldDefaultValue(field: PluginFieldSchema) {
  if (field.type === 'SWITCH') return false
  if (
    field.type === 'CHECKBOX' ||
    field.type === 'MULTI_SELECT' ||
    field.type === 'LIST' ||
    field.type === 'OBJECT_LIST'
  ) {
    return []
  }
  if (field.type === 'MAP') return {}
  if (field.type === 'NUMBER') return undefined
  return ''
}

export function objectListSchemaFields(field: PluginFieldSchema) {
  const itemSchema = (field as { itemSchema?: unknown }).itemSchema
  if (!isRecord(itemSchema) || !Array.isArray(itemSchema.fields)) return []
  return itemSchema.fields as PluginFieldSchema[]
}

export function createSchemaObjectListRow(fields: PluginFieldSchema[]) {
  const row = fields.reduce<SchemaModel>((model, field) => {
    model[field.name] = schemaFieldDefaultValue(field)
    return model
  }, {})
  return registerSchemaRow(row)
}

export function buildSchemaModel(
  fields: PluginFieldSchema[],
  existing: SchemaModel,
  mode: 'create' | 'edit',
) {
  return fields.reduce<SchemaModel>((model, field) => {
    model[field.name] = buildSchemaFieldValue(
      field,
      existing[field.name],
      own(existing, field.name),
      mode,
    )
    return model
  }, {})
}

function buildSchemaFieldValue(
  field: PluginFieldSchema,
  existingValue: unknown,
  hasExistingValue: boolean,
  mode: 'create' | 'edit',
): unknown {
  if (field.sensitive && mode === 'edit') return ''
  if (!hasExistingValue) return schemaFieldDefaultValue(field)
  if (field.type === 'OBJECT_LIST') return buildObjectListValue(field, existingValue, mode)
  return normalizeFieldValue(field, existingValue)
}

function buildObjectListValue(field: PluginFieldSchema, value: unknown, mode: 'create' | 'edit') {
  if (!Array.isArray(value)) return []
  const childFields = objectListSchemaFields(field)

  return value.map((item) => {
    const original = isRecord(item) ? rawObject(item) : {}
    const row: SchemaModel = { ...original }
    childFields.forEach((child) => {
      row[child.name] = buildSchemaFieldValue(
        child,
        original[child.name],
        own(original, child.name),
        mode,
      )
    })
    return registerSchemaRow(row, original, true)
  })
}

export function mergeConfigModel(
  original: SchemaModel,
  fields: PluginConfigSchemaField[],
  model: SchemaModel,
) {
  const merged = { ...original }
  fields.forEach((field) => {
    merged[field.name] = normalizeFieldValue(field, model[field.name])
  })
  return merged
}

export function mergeAccountModel(
  original: SchemaModel,
  fields: PluginFieldSchema[],
  model: SchemaModel,
  mode: 'create' | 'edit',
) {
  const merged = { ...original }
  fields.forEach((field) => {
    mergeAccountField(merged, original, field, model[field.name], mode)
  })
  return merged
}

function mergeAccountField(
  target: SchemaModel,
  original: SchemaModel,
  field: PluginFieldSchema,
  editedValue: unknown,
  mode: 'create' | 'edit',
) {
  const hasOriginalValue = own(original, field.name)

  if (mode === 'edit' && field.readonly) {
    if (hasOriginalValue) target[field.name] = original[field.name]
    else delete target[field.name]
    return
  }

  if (
    field.sensitive &&
    ((mode === 'edit' && isEmptyValue(editedValue)) || isMaskedSensitiveValue(editedValue))
  ) {
    if (hasOriginalValue) target[field.name] = original[field.name]
    else delete target[field.name]
    return
  }

  target[field.name] =
    field.type === 'OBJECT_LIST'
      ? mergeAccountObjectListValue(field, original[field.name], editedValue, mode)
      : normalizeFieldValue(field, editedValue)
}

function mergeAccountObjectListValue(
  field: PluginFieldSchema,
  originalValue: unknown,
  editedValue: unknown,
  mode: 'create' | 'edit',
) {
  if (!Array.isArray(editedValue)) return []
  const originalRows = Array.isArray(originalValue) ? originalValue : []
  const childFields = objectListSchemaFields(field)

  return editedValue.map((item, index) => {
    const editedRow = isRecord(item) ? item : {}
    const metadata = getSchemaRowMetadata(editedRow)
    const fallbackOriginal = isRecord(originalRows[index]) ? originalRows[index] : {}
    const originalRow = metadata
      ? metadata.hasOriginal
        ? metadata.original || {}
        : {}
      : fallbackOriginal
    const mergedRow: SchemaModel = { ...editedRow }

    childFields.forEach((child) => {
      mergeAccountField(mergedRow, originalRow, child, editedRow[child.name], mode)
    })
    return mergedRow
  })
}

function normalizeFieldValue(field: PluginFieldSchema, value: unknown): unknown {
  if (field.type === 'SWITCH') return Boolean(value)
  if (field.type === 'CHECKBOX' || field.type === 'MULTI_SELECT' || field.type === 'LIST') {
    return Array.isArray(value) ? value : []
  }
  if (field.type === 'MAP') return isRecord(value) ? value : {}
  if (field.type === 'OBJECT_LIST') return normalizeObjectListValue(field, value)
  if (field.type === 'NUMBER') {
    return value === '' || value === undefined || value === null ? undefined : Number(value)
  }
  return value ?? ''
}

function normalizeObjectListValue(field: PluginFieldSchema, value: unknown) {
  if (!Array.isArray(value)) return []
  const childFields = objectListSchemaFields(field)

  return value.map((item) => {
    const row: SchemaModel = isRecord(item) ? { ...item } : {}
    childFields.forEach((child) => {
      row[child.name] = normalizeFieldValue(
        child,
        own(row, child.name) ? row[child.name] : schemaFieldDefaultValue(child),
      )
    })
    return row
  })
}

export function getSchemaValueAtPath(model: SchemaModel, path: SchemaPath) {
  return path.reduce<unknown>((value, segment) => {
    if (Array.isArray(value) && typeof segment === 'number') return value[segment]
    if (isRecord(value) && typeof segment === 'string') return value[segment]
    return undefined
  }, model)
}

export function updateSchemaValueAtPath(
  model: SchemaModel,
  path: SchemaPath,
  value: unknown,
): SchemaModel {
  if (!path.length) return isRecord(value) ? value : model

  function update(current: unknown, index: number): unknown {
    if (index === path.length) return value
    const segment = path[index]
    const nextSegment = path[index + 1]
    const clone: SchemaModel | unknown[] = Array.isArray(current)
      ? [...current]
      : isRecord(current)
        ? { ...current }
        : typeof segment === 'number'
          ? []
          : {}
    transferSchemaRowMetadata(current, clone)

    const currentChild =
      Array.isArray(current) && typeof segment === 'number'
        ? current[segment]
        : isRecord(current) && typeof segment === 'string'
          ? current[segment]
          : typeof nextSegment === 'number'
            ? []
            : {}

    if (Array.isArray(clone) && typeof segment === 'number') {
      clone[segment] = update(currentChild, index + 1)
    } else if (isRecord(clone) && typeof segment === 'string') {
      clone[segment] = update(currentChild, index + 1)
    }
    return clone
  }

  return update(model, 0) as SchemaModel
}

export function formatSchemaPath(path: SchemaPath) {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    return result ? `${result}.${segment}` : segment
  }, '')
}

export function getObjectListSchemaError(
  field: PluginFieldSchema,
  objectListDepth: number,
  path: SchemaPath,
): string {
  const pathLabel = formatSchemaPath(path) || field.name
  if (objectListDepth > PLUGIN_SCHEMA_MAX_OBJECT_LIST_DEPTH) {
    return `Schema 错误：字段 ${pathLabel} 的 OBJECT_LIST 超过最大 16 层`
  }

  const itemSchema = (field as { itemSchema?: unknown }).itemSchema
  if (!isRecord(itemSchema)) {
    return `Schema 错误：字段 ${pathLabel} 的 OBJECT_LIST 缺少合法 itemSchema`
  }
  if (!Array.isArray(itemSchema.fields)) {
    return `Schema 错误：字段 ${pathLabel} 的 itemSchema.fields 必须是数组`
  }

  for (const child of itemSchema.fields as PluginFieldSchema[]) {
    if (String(child?.type).toUpperCase() !== 'OBJECT_LIST') continue
    const nestedError = getObjectListSchemaError(child, objectListDepth + 1, [...path, child.name])
    if (nestedError) return nestedError
  }
  return ''
}

export function validateSchemaModel(
  fields: PluginFieldSchema[],
  values: SchemaModel,
  options: SchemaValidationOptions,
) {
  const errors = new Map<string, string>()
  validateSchemaFields(fields, values, [], 0, options, errors)
  return errors
}

function validateSchemaFields(
  fields: PluginFieldSchema[],
  values: SchemaModel,
  parentPath: SchemaPath,
  objectListDepth: number,
  options: SchemaValidationOptions,
  errors: Map<string, string>,
) {
  visibleSchemaFields(fields, values).forEach((field) => {
    const path = [...parentPath, field.name]
    const pathKey = formatSchemaPath(path)
    const value = values[field.name]

    if (field.type === 'OBJECT_LIST') {
      const currentDepth = objectListDepth + 1
      const schemaError = getObjectListSchemaError(field, currentDepth, path)
      if (schemaError) {
        errors.set(pathKey, schemaError)
        return
      }

      const rows = asObjectListRows(value)
      if (field.required && rows.length === 0) {
        errors.set(pathKey, `请至少填写一个${field.label}`)
        return
      }

      const childFields = objectListSchemaFields(field)
      rows.forEach((row, rowIndex) => {
        validateSchemaFields(childFields, row, [...path, rowIndex], currentDepth, options, errors)
      })
      return
    }

    if (options.mode === 'account' && options.submitMode === 'edit' && field.sensitive) {
      return
    }

    const error = validateLeafField(field, value)
    if (error) errors.set(pathKey, error)
  })
}

function validateLeafField(field: PluginFieldSchema, value: unknown) {
  if (!field.required) return validateMap(field, value)

  if (field.type === 'SWITCH') return typeof value === 'boolean' ? '' : '请选择开关状态'
  if (field.type === 'CHECKBOX' || field.type === 'MULTI_SELECT' || field.type === 'LIST') {
    return asArray(value).length > 0 ? '' : `请至少填写一个${field.label}`
  }
  if (field.type === 'MAP') {
    return Object.keys(isRecord(value) ? value : {}).length > 0
      ? validateMap(field, value)
      : `请至少填写一个${field.label}`
  }
  if (field.type === 'NUMBER') {
    return typeof value === 'number' && !Number.isNaN(value) ? '' : `请输入${field.label}`
  }
  return asString(value).trim() ? '' : `请输入${field.label}`
}

function validateMap(field: PluginFieldSchema, value: unknown) {
  if (field.type !== 'MAP') return ''
  const rows = asMapRows(value)
  const keys = rows.map((row) => row.key).filter(Boolean)
  if (rows.some((row) => !row.key)) return 'Map 的 key 不能为空'
  if (new Set(keys).size !== keys.length) return 'Map 的 key 不能重复'
  return ''
}

function asObjectListRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item): SchemaModel => (isRecord(item) ? item : {}))
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown) {
  return typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : String(value)
}

function asMapRows(value: unknown) {
  if (!isRecord(value)) return []
  return Object.entries(value).map(([key, item]) => ({ key, value: asString(item) }))
}

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || value === ''
}
