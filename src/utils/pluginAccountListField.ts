import type { PluginAccountListField } from '@/types/plugins'
import { formatDate, formatDateTime, formatTime } from '@/utils/format'

export function isEmptyAccountListValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.length === 0) ||
    (Array.isArray(value) && value.length === 0)
  )
}

function safeText(value: unknown) {
  if (isEmptyAccountListValue(value)) return '-'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value) || '-'
  } catch {
    return '-'
  }
}

export function formatPluginAccountListValue(field: PluginAccountListField, value: unknown) {
  if (isEmptyAccountListValue(value)) return '-'

  switch (field.type) {
    case 'DATE':
      return typeof value === 'string' || typeof value === 'number' || value instanceof Date
        ? formatDate(value)
        : safeText(value)
    case 'TIME':
      return typeof value === 'string' || typeof value === 'number' || value instanceof Date
        ? formatTime(value)
        : safeText(value)
    case 'DATETIME':
      return typeof value === 'string' || typeof value === 'number' || value instanceof Date
        ? formatDateTime(value)
        : safeText(value)
    case 'NUMBER':
      return typeof value === 'number' ? String(value) : safeText(value)
    case 'RADIO':
    case 'SELECT':
      return safeText(value)
    default:
      return safeText(value)
  }
}

export function normalizePluginAccountMultiSelect(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return []
  return value
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map((item) => safeText(item))
}

export function normalizePluginAccountBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function resolvePluginAccountListFields(
  fields: string[],
  availableFields: PluginAccountListField[],
) {
  const byName = new Map(availableFields.map((field) => [field.name, field]))
  return fields.flatMap((name) => {
    const field = byName.get(name)
    return field ? [field] : []
  })
}
