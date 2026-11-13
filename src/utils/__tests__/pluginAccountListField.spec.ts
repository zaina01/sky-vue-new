import { describe, expect, it } from 'vitest'

import type { PluginAccountListField } from '@/types/plugins'
import {
  formatPluginAccountListValue,
  isEmptyAccountListValue,
  normalizePluginAccountBoolean,
  normalizePluginAccountMultiSelect,
  resolvePluginAccountListFields,
} from '@/utils/pluginAccountListField'

function field(type: PluginAccountListField['type']): PluginAccountListField {
  return { name: type.toLowerCase(), label: type, type, options: [] }
}

describe('plugin account list field values', () => {
  it('uses a dash only for nullish, empty-string and empty-array values', () => {
    expect([null, undefined, '', []].every(isEmptyAccountListValue)).toBe(true)
    expect(isEmptyAccountListValue(0)).toBe(false)
    expect(isEmptyAccountListValue(false)).toBe(false)
    expect(formatPluginAccountListValue(field('NUMBER'), 0)).toBe('0')
    expect(formatPluginAccountListValue(field('CHECKBOX'), false)).toBe('false')
  })

  it('formats date, time and datetime values through the shared formatters', () => {
    expect(formatPluginAccountListValue(field('DATE'), '2026-08-12')).toBe('2026/08/12')
    expect(formatPluginAccountListValue(field('TIME'), '09:10:11')).toBe('09:10:11')
    expect(formatPluginAccountListValue(field('DATETIME'), '2026-08-12T09:10:11')).toBe(
      '2026/08/12 09:10:11',
    )
  })

  it('safely degrades unexpected values without throwing', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatPluginAccountListValue(field('TEXT'), circular)).toBe('-')
    expect(normalizePluginAccountMultiSelect('not-an-array')).toEqual([])
    expect(normalizePluginAccountMultiSelect(['华东', 0, false, null])).toEqual([
      '华东',
      '0',
      'false',
    ])
    expect(normalizePluginAccountBoolean(false)).toBe(false)
    expect(normalizePluginAccountBoolean('false')).toBeUndefined()
  })

  it('resolves columns by preference order and ignores missing fields', () => {
    const availableFields = [
      { ...field('TEXT'), name: 'username' },
      { ...field('SELECT'), name: 'region' },
    ]
    expect(
      resolvePluginAccountListFields(['region', 'removed', 'username'], availableFields).map(
        (item) => item.name,
      ),
    ).toEqual(['region', 'username'])
  })
})
