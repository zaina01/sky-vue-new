<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { listSystemSettings, updateSystemSettings } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import type { SystemSettingCategory, SystemSettingItem } from '@/types/system'
import { formatDateTime } from '@/utils/format'

interface CategoryGroup {
  category: SystemSettingCategory
  items: SystemSettingItem[]
}

interface SettingGroup {
  name: string
  items: SystemSettingItem[]
}

const categoryOrder: SystemSettingCategory[] = [
  'RETENTION',
  'NOTIFICATION',
  'PLUGIN_STORAGE',
  'PLUGIN_UPLOAD',
  'PLUGIN_RUNTIME',
  'SECURITY',
]

const categoryLabels: Record<SystemSettingCategory, string> = {
  RETENTION: '数据保留',
  NOTIFICATION: '通知设置',
  PLUGIN_STORAGE: '插件存储',
  PLUGIN_UPLOAD: '插件上传',
  PLUGIN_RUNTIME: '插件运行器',
  SECURITY: '安全设置',
}

const loading = ref(false)
const saving = ref(false)
const settings = ref<SystemSettingItem[]>([])
const activeCategory = ref<SystemSettingCategory>('RETENTION')
const formValues = reactive<Record<string, unknown>>({})
const originalValues = ref<Record<string, unknown>>({})

const groupedSettings = computed<CategoryGroup[]>(() => {
  const knownGroups = categoryOrder
    .map((category) => ({
      category,
      items: settings.value.filter((setting) => setting.category === category),
    }))
    .filter((group) => group.items.length > 0)

  const knownCategories = new Set(categoryOrder)
  const extraGroups = Array.from(
    new Set(
      settings.value
        .map((setting) => setting.category)
        .filter((category) => !knownCategories.has(category)),
    ),
  ).map((category) => ({
    category,
    items: settings.value.filter((setting) => setting.category === category),
  }))

  return [...knownGroups, ...extraGroups]
})

const changedValues = computed(() => getChangedValues())
const hasChanges = computed(() => Object.keys(changedValues.value).length > 0)
const changedCount = computed(() => Object.keys(changedValues.value).length)
const editableCount = computed(() => settings.value.filter((setting) => setting.editable).length)
const readonlyCount = computed(() => settings.value.length - editableCount.value)

function settingLabel(setting: SystemSettingItem) {
  return setting.displayName || setting.key
}

function categoryLabel(category: SystemSettingCategory) {
  return categoryLabels[category] || category
}

function settingPlaceholder(setting: SystemSettingItem) {
  return setting.placeholder || ''
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return undefined
}

function inputMin(setting: SystemSettingItem) {
  return parseNumber(setting.min)
}

function inputMax(setting: SystemSettingItem) {
  return parseNumber(setting.max)
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function toDisplayValue(setting: SystemSettingItem): unknown {
  switch (setting.valueType) {
    case 'BOOLEAN':
      return Boolean(setting.value)
    case 'INTEGER':
    case 'LONG':
      return parseNumber(setting.value) ?? 0
    case 'STRING_LIST':
      return toStringArray(setting.value)
    case 'DURATION':
    case 'CRON':
    case 'STRING':
    default:
      return String(setting.value ?? '')
  }
}

function toSubmitValue(setting: SystemSettingItem, displayValue: unknown): unknown {
  switch (setting.valueType) {
    case 'BOOLEAN':
      return Boolean(displayValue)
    case 'INTEGER':
    case 'LONG':
      return Math.trunc(parseNumber(displayValue) ?? 0)
    case 'STRING_LIST':
      return toStringArray(displayValue)
        .map((item) => item.trim())
        .filter(Boolean)
    case 'DURATION':
    case 'CRON':
    case 'STRING':
    default:
      return String(displayValue ?? '').trim()
  }
}

function normalizeComparableValue(value: unknown) {
  return JSON.stringify(value)
}

function isSettingChanged(setting: SystemSettingItem) {
  if (!setting.editable) return false
  const nextValue = toSubmitValue(setting, formValues[setting.key])
  return (
    normalizeComparableValue(nextValue) !==
    normalizeComparableValue(originalValues.value[setting.key])
  )
}

function getChangedValues() {
  return settings.value.reduce<Record<string, unknown>>((values, setting) => {
    if (!isSettingChanged(setting)) return values
    values[setting.key] = toSubmitValue(setting, formValues[setting.key])
    return values
  }, {})
}

function validateChangedValues(values: Record<string, unknown>) {
  const changedKeys = new Set(Object.keys(values))
  const invalidSetting = settings.value.find((setting) => {
    if (!changedKeys.has(setting.key)) return false
    if (setting.valueType !== 'INTEGER' && setting.valueType !== 'LONG') return false

    const value = values[setting.key]
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value))
      return true

    const min = inputMin(setting)
    const max = inputMax(setting)
    return (min !== undefined && value < min) || (max !== undefined && value > max)
  })

  if (invalidSetting) {
    ElMessage.warning(`请检查配置项 ${settingLabel(invalidSetting)} 的数值范围`)
    return false
  }

  return true
}

function resetFormState(items: SystemSettingItem[]) {
  Object.keys(formValues).forEach((key) => delete formValues[key])

  const originals: Record<string, unknown> = {}
  items.forEach((setting) => {
    formValues[setting.key] = toDisplayValue(setting)
    originals[setting.key] = toSubmitValue(setting, formValues[setting.key])
  })
  originalValues.value = originals
}

function applySettings(items: SystemSettingItem[]) {
  settings.value = items
  resetFormState(items)

  const categories = new Set(items.map((setting) => setting.category))
  if (!categories.has(activeCategory.value)) {
    activeCategory.value = groupedSettings.value[0]?.category ?? 'RETENTION'
  }
}

async function loadSettings() {
  loading.value = true
  try {
    const items = await listSystemSettings()
    applySettings(items)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  const values = getChangedValues()
  if (!Object.keys(values).length) {
    ElMessage.info('没有需要保存的变更')
    return
  }

  if (!validateChangedValues(values)) return

  saving.value = true
  try {
    const updated = await updateSystemSettings(values)
    ElMessage.success('系统设置已保存')
    applySettings(updated)
  } finally {
    saving.value = false
  }
}

function stringListOptions(setting: SystemSettingItem) {
  return toStringArray(formValues[setting.key])
}

function settingGroups(items: SystemSettingItem[]) {
  return items.reduce<SettingGroup[]>((groups, setting) => {
    const name = setting.group || '未分组'
    const group = groups.find((item) => item.name === name)
    if (group) {
      group.items.push(setting)
    } else {
      groups.push({ name, items: [setting] })
    }
    return groups
  }, [])
}

function categoryChangedCount(category: SystemSettingCategory) {
  return settings.value.filter(
    (setting) => setting.category === category && isSettingChanged(setting),
  ).length
}

function groupChangedCount(group: SettingGroup) {
  return group.items.filter(isSettingChanged).length
}

function valueTypeTagType(valueType: SystemSettingItem['valueType']) {
  if (valueType === 'BOOLEAN') return 'success'
  if (valueType === 'INTEGER' || valueType === 'LONG') return 'warning'
  if (valueType === 'CRON' || valueType === 'DURATION') return 'primary'
  if (valueType === 'STRING_LIST') return 'info'
  return undefined
}

function rangeText(setting: SystemSettingItem) {
  const hasMin = setting.min !== undefined && setting.min !== null
  const hasMax = setting.max !== undefined && setting.max !== null
  if (hasMin && hasMax) return `${setting.min} ~ ${setting.max}`
  if (hasMin) return `≥ ${setting.min}`
  if (hasMax) return `≤ ${setting.max}`
  return ''
}

function isoDurationHint(value: unknown) {
  if (typeof value !== 'string') return ''
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return ''

  const parts = [
    match[1] ? `${match[1]} 小时` : '',
    match[2] ? `${match[2]} 分钟` : '',
    match[3] ? `${match[3]} 秒` : '',
  ].filter(Boolean)

  return parts.length ? parts.join(' ') : ''
}

onMounted(loadSettings)
</script>

<template>
  <PageContainer title="系统设置" description="查看并修改服务端白名单内的运行时配置。">
    <template #extra>
      <PermissionGuard permission="system:setting:write">
        <el-button
          type="primary"
          :loading="saving"
          :disabled="loading || !hasChanges"
          @click="saveSettings"
        >
          保存 {{ changedCount ? `(${changedCount})` : '' }}
        </el-button>
      </PermissionGuard>
      <el-button :loading="loading" @click="loadSettings">刷新</el-button>
    </template>

    <section class="settings-console">
      <div class="settings-hero">
        <div>
          <p class="settings-kicker">Runtime Configuration</p>
          <h2>运行时配置中心</h2>
          <p>配置项展示元数据由服务端返回，当前页面仅提交已修改的白名单配置。</p>
        </div>
        <div class="settings-stats">
          <div class="stat-card stat-card--strong">
            <span class="stat-card__value">{{ settings.length }}</span>
            <span class="stat-card__label">配置项</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">{{ editableCount }}</span>
            <span class="stat-card__label">可编辑</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value">{{ readonlyCount }}</span>
            <span class="stat-card__label">只读</span>
          </div>
          <div class="stat-card stat-card--dirty">
            <span class="stat-card__value">{{ changedCount }}</span>
            <span class="stat-card__label">待保存</span>
          </div>
        </div>
      </div>

      <el-skeleton v-if="loading && !settings.length" :rows="8" animated />

      <el-empty v-else-if="!settings.length" description="暂无可配置项" />

      <el-tabs v-else v-model="activeCategory" class="settings-tabs">
        <el-tab-pane
          v-for="categoryGroup in groupedSettings"
          :key="categoryGroup.category"
          :name="categoryGroup.category"
        >
          <template #label>
            <span class="category-tab">
              <span>{{ categoryLabel(categoryGroup.category) }}</span>
              <em>{{ categoryGroup.items.length }}</em>
              <b v-if="categoryChangedCount(categoryGroup.category)">
                {{ categoryChangedCount(categoryGroup.category) }}
              </b>
            </span>
          </template>

          <div class="settings-stack">
            <section
              v-for="group in settingGroups(categoryGroup.items)"
              :key="group.name"
              class="setting-section"
            >
              <header class="setting-section__header">
                <div>
                  <h2>{{ group.name }}</h2>
                  <p>{{ group.items.length }} 个配置项</p>
                </div>
                <el-tag v-if="groupChangedCount(group)" type="warning" effect="light">
                  {{ groupChangedCount(group) }} 项已修改
                </el-tag>
              </header>

              <div class="setting-list">
                <article
                  v-for="setting in group.items"
                  :key="setting.key"
                  class="setting-row"
                  :class="{
                    'setting-row--dirty': isSettingChanged(setting),
                    'setting-row--readonly': !setting.editable,
                  }"
                >
                  <div class="setting-row__main">
                    <div class="setting-row__titleline">
                      <h3>{{ settingLabel(setting) }}</h3>
                      <el-tag
                        size="small"
                        effect="plain"
                        :type="valueTypeTagType(setting.valueType)"
                      >
                        {{ setting.valueType }}
                      </el-tag>
                      <el-tag v-if="!setting.editable" size="small" type="info" effect="plain">
                        只读
                      </el-tag>
                      <el-tag
                        v-if="isSettingChanged(setting)"
                        size="small"
                        type="warning"
                        effect="light"
                      >
                        已修改
                      </el-tag>
                    </div>
                    <p v-if="setting.description" class="setting-description">
                      {{ setting.description }}
                    </p>
                    <div class="setting-keyline">{{ setting.key }}</div>
                    <div class="setting-meta">
                      <span v-if="rangeText(setting)">范围 {{ rangeText(setting) }}</span>
                      <span v-if="setting.valueText">原始值 {{ setting.valueText }}</span>
                      <span>更新于 {{ formatDateTime(setting.updatedAt) }}</span>
                    </div>
                  </div>

                  <div class="setting-row__control">
                    <el-switch
                      v-if="setting.valueType === 'BOOLEAN'"
                      v-model="formValues[setting.key]"
                      :disabled="!setting.editable || saving"
                    />

                    <template
                      v-else-if="setting.valueType === 'INTEGER' || setting.valueType === 'LONG'"
                    >
                      <el-input-number
                        v-model="formValues[setting.key]"
                        :min="inputMin(setting)"
                        :max="inputMax(setting)"
                        :step="1"
                        :disabled="!setting.editable || saving"
                        controls-position="right"
                      />
                      <span v-if="setting.unit" class="setting-unit">{{ setting.unit }}</span>
                    </template>

                    <el-select
                      v-else-if="setting.valueType === 'STRING_LIST'"
                      v-model="formValues[setting.key]"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      :disabled="!setting.editable || saving"
                      class="setting-select"
                      :placeholder="settingPlaceholder(setting)"
                    >
                      <el-option
                        v-for="option in stringListOptions(setting)"
                        :key="option"
                        :label="option"
                        :value="option"
                      />
                    </el-select>

                    <el-input
                      v-else
                      v-model="formValues[setting.key]"
                      :disabled="!setting.editable || saving"
                      :placeholder="settingPlaceholder(setting)"
                      clearable
                    >
                      <template v-if="setting.unit" #append>{{ setting.unit }}</template>
                    </el-input>

                    <div
                      v-if="setting.valueType === 'DURATION' && isoDurationHint(setting.value)"
                      class="setting-hint"
                    >
                      当前约为 {{ isoDurationHint(setting.value) }}
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageContainer>
</template>

<style scoped>
.settings-console {
  position: relative;
  overflow: hidden;
  padding: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 18px;
  background:
    radial-gradient(circle at 10% 0%, rgba(64, 158, 255, 0.12), transparent 30%),
    linear-gradient(180deg, var(--el-fill-color-extra-light), var(--el-bg-color));
}

.settings-hero {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto;
  gap: 20px;
  align-items: stretch;
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid rgba(64, 158, 255, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 42px rgba(31, 45, 61, 0.06);
}

.settings-kicker {
  margin: 0 0 8px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.settings-hero h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  line-height: 1.2;
}

.settings-hero p:not(.settings-kicker) {
  max-width: 680px;
  margin: 10px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.settings-stats {
  display: grid;
  grid-template-columns: repeat(4, 88px);
  gap: 10px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 82px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: var(--el-bg-color);
}

.stat-card--strong {
  border-color: rgba(64, 158, 255, 0.24);
  background: linear-gradient(180deg, rgba(64, 158, 255, 0.1), var(--el-bg-color));
}

.stat-card--dirty {
  border-color: rgba(230, 162, 60, 0.28);
  background: linear-gradient(180deg, rgba(230, 162, 60, 0.12), var(--el-bg-color));
}

.stat-card__value {
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 750;
  line-height: 1;
}

.stat-card__label {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.settings-tabs :deep(.el-tabs__header) {
  position: sticky;
  top: 0;
  z-index: 2;
  margin-bottom: 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(10px);
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.settings-tabs :deep(.el-tabs__nav-scroll),
.settings-tabs :deep(.el-tabs__nav) {
  width: 100%;
}

.settings-tabs :deep(.el-tabs__nav) {
  display: flex;
}

.settings-tabs :deep(.el-tabs__item) {
  flex: 1;
  justify-content: center;
  padding: 0 12px;
}

.category-tab {
  display: inline-flex;
  justify-content: center;
  gap: 10px;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding: 0 2px;
}

.category-tab > span {
  display: inline-block;
  min-width: 4em;
  text-align: center;
  white-space: nowrap;
}

.category-tab em,
.category-tab b {
  min-width: 22px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-style: normal;
  line-height: 20px;
  text-align: center;
}

.category-tab em {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.category-tab b {
  color: #8a4b00;
  background: rgba(230, 162, 60, 0.18);
}

.settings-stack {
  display: grid;
  gap: 18px;
}

.setting-section {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 10px 30px rgba(31, 45, 61, 0.04);
}

.setting-section__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.08), transparent);
}

.setting-section__header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
}

.setting-section__header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.setting-list {
  display: grid;
}

.setting-row {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 420px);
  gap: 24px;
  align-items: center;
  padding: 18px;
  border-left: 3px solid transparent;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.setting-row:hover {
  background: rgba(64, 158, 255, 0.035);
}

.setting-row--dirty {
  border-left-color: var(--el-color-warning);
  background: rgba(230, 162, 60, 0.045);
}

.setting-row--readonly {
  background-image: linear-gradient(135deg, rgba(144, 147, 153, 0.045), transparent 40%);
}

.setting-row__titleline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.setting-row__titleline h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 700;
}

.setting-description {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.setting-keyline {
  margin-top: 8px;
  color: var(--el-text-color-placeholder);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  word-break: break-all;
}

.setting-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.setting-row__control {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.setting-row__control :deep(.el-input),
.setting-row__control :deep(.el-select) {
  width: 100%;
}

.setting-row__control :deep(.el-input-number) {
  width: 220px;
}

.setting-select {
  width: 100%;
}

.setting-unit,
.setting-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.setting-hint {
  width: 100%;
  text-align: right;
}

@media (max-width: 1180px) {
  .settings-hero,
  .setting-row {
    grid-template-columns: 1fr;
  }

  .settings-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .setting-row__control {
    justify-content: flex-start;
  }

  .setting-hint {
    text-align: left;
  }
}

@media (max-width: 720px) {
  .settings-console,
  .settings-hero,
  .setting-row {
    padding: 12px;
  }

  .settings-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
