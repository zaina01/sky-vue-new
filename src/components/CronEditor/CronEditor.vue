<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

import { previewCronNext, validateCronExpression } from '@/api/jobs'
import { formatDateTime } from '@/utils/format'
import {
  isQuartzCronSegmentCount,
  joinQuartzCron,
  splitQuartzCron,
  type QuartzCronParts,
} from '@/utils/quartzCron'

type PresetType = 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly' | 'workday' | 'seconds'
type FieldMode = 'any' | 'unspecified' | 'value' | 'list' | 'range' | 'step' | 'advanced'
type CronFieldKey = keyof QuartzCronParts

interface FieldState {
  mode: FieldMode
  value: string
  start: string
  end: string
  stepStart: string
  step: string
  advanced: string
}

const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'valid-change', valid: boolean): void
  (event: 'validate-message-change', message: string): void
}>()

const expression = ref(props.modelValue)
const activeTab = ref('preset')
const presetType = ref<PresetType>('minutes')
const preset = reactive({
  interval: 5,
  hour: 2,
  minute: 0,
  day: 1,
  weekday: 'MON',
})
const fields = reactive<Record<CronFieldKey, FieldState>>({
  second: createField('value', '0'),
  minute: createField('step', '', '0', '', '5'),
  hour: createField('any', '*'),
  dayOfMonth: createField('any', '*'),
  month: createField('any', '*'),
  dayOfWeek: createField('unspecified', '?'),
  year: createField('advanced', ''),
})
const yearEnabled = ref(false)
const validating = ref(false)
const cronValid = ref(false)
const validationMessage = ref('')
const previewLoading = ref(false)
const nextFireTimes = ref<string[]>([])
let validateTimer: number | undefined
let requestSequence = 0

const weekdayOptions = [
  { label: '周日', value: 'SUN' },
  { label: '周一', value: 'MON' },
  { label: '周二', value: 'TUE' },
  { label: '周三', value: 'WED' },
  { label: '周四', value: 'THU' },
  { label: '周五', value: 'FRI' },
  { label: '周六', value: 'SAT' },
]

const fieldConfigs: Array<{ key: CronFieldKey; label: string; placeholder: string }> = [
  { key: 'second', label: '秒', placeholder: '0-59' },
  { key: 'minute', label: '分', placeholder: '0-59' },
  { key: 'hour', label: '时', placeholder: '0-23' },
  { key: 'dayOfMonth', label: '日', placeholder: '1-31, L, W, LW' },
  { key: 'month', label: '月', placeholder: '1-12 或 JAN-DEC' },
  { key: 'dayOfWeek', label: '周', placeholder: 'SUN-SAT, L, #' },
  { key: 'year', label: '年', placeholder: '可选，例如 2026 或 2026-2030' },
]

const statusType = computed(() => {
  if (!expression.value.trim()) return 'info'
  if (validating.value) return 'warning'
  return cronValid.value ? 'success' : 'danger'
})
const statusText = computed(() => {
  if (!expression.value.trim()) return '请输入 Quartz Cron 表达式'
  if (validating.value) return '正在校验 Cron 表达式'
  if (cronValid.value) return 'Cron 表达式合法'
  return validationMessage.value || 'Cron 表达式不合法'
})
const hasValidSegmentCount = computed(
  () => !expression.value.trim() || isQuartzCronSegmentCount(expression.value),
)

watch(
  () => props.modelValue,
  (value) => {
    if (value === expression.value) return
    expression.value = value
    syncFieldsFromExpression(value)
    scheduleValidation()
  },
)

watch(expression, (value) => {
  emit('update:modelValue', value)
  scheduleValidation()
})

scheduleValidation()

function createField(
  mode: FieldMode,
  value = '',
  stepStart = '*',
  advanced = '',
  step = '1',
): FieldState {
  return {
    mode,
    value,
    start: '',
    end: '',
    stepStart,
    step,
    advanced,
  }
}

function setExpression(value: string) {
  expression.value = value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function applyPreset() {
  const interval = clamp(Number(preset.interval) || 1, 1, 999)
  const hour = clamp(Number(preset.hour) || 0, 0, 23)
  const minute = clamp(Number(preset.minute) || 0, 0, 59)
  const day = clamp(Number(preset.day) || 1, 1, 31)

  if (presetType.value === 'seconds') setExpression(`0/${interval} * * * * ?`)
  if (presetType.value === 'minutes') setExpression(`0 0/${interval} * * * ?`)
  if (presetType.value === 'hours') setExpression(`0 0 0/${interval} * * ?`)
  if (presetType.value === 'daily') setExpression(`0 ${minute} ${hour} * * ?`)
  if (presetType.value === 'weekly') setExpression(`0 ${minute} ${hour} ? * ${preset.weekday}`)
  if (presetType.value === 'monthly') setExpression(`0 ${minute} ${hour} ${day} * ?`)
  if (presetType.value === 'workday') setExpression(`0 ${minute} ${hour} ? * MON-FRI`)
}

function syncFieldsFromExpression(value: string) {
  const parts = splitQuartzCron(value)
  if (!parts) return

  setFieldFromSegment('second', parts.second)
  setFieldFromSegment('minute', parts.minute)
  setFieldFromSegment('hour', parts.hour)
  setFieldFromSegment('dayOfMonth', parts.dayOfMonth)
  setFieldFromSegment('month', parts.month)
  setFieldFromSegment('dayOfWeek', parts.dayOfWeek)
  setFieldFromSegment('year', parts.year || '')
  yearEnabled.value = Boolean(parts.year)
}

function setFieldFromSegment(key: CronFieldKey, segment: string) {
  const field = fields[key]
  field.advanced = segment

  if (!segment) {
    field.mode = 'advanced'
    return
  }
  if (segment === '*') {
    field.mode = 'any'
    field.value = '*'
    return
  }
  if (segment === '?') {
    field.mode = 'unspecified'
    field.value = '?'
    return
  }
  if (segment.includes('/')) {
    const [start, step] = segment.split('/')
    field.mode = 'step'
    field.stepStart = start || '*'
    field.step = step || '1'
    return
  }
  if (segment.includes('-') && !segment.includes(',')) {
    const [start, end] = segment.split('-')
    field.mode = 'range'
    field.start = start || ''
    field.end = end || ''
    return
  }
  if (segment.includes(',')) {
    field.mode = 'list'
    field.value = segment
    return
  }

  field.mode = 'value'
  field.value = segment
}

function buildSegment(field: FieldState) {
  if (field.mode === 'any') return '*'
  if (field.mode === 'unspecified') return '?'
  if (field.mode === 'value' || field.mode === 'list') return field.value || '*'
  if (field.mode === 'range') return `${field.start || '*'}-${field.end || '*'}`
  if (field.mode === 'step') return `${field.stepStart || '*'}/${field.step || '1'}`
  return field.advanced || '*'
}

function applyFields() {
  const dayOfMonth = buildSegment(fields.dayOfMonth)
  const dayOfWeek = buildSegment(fields.dayOfWeek)
  const parts: QuartzCronParts = {
    second: buildSegment(fields.second),
    minute: buildSegment(fields.minute),
    hour: buildSegment(fields.hour),
    dayOfMonth,
    month: buildSegment(fields.month),
    dayOfWeek,
    year: yearEnabled.value ? buildSegment(fields.year) : undefined,
  }

  setExpression(joinQuartzCron(parts))
}

function setDayMode(key: 'dayOfMonth' | 'dayOfWeek', mode: FieldMode) {
  fields[key].mode = mode
  if (key === 'dayOfMonth' && mode !== 'unspecified') fields.dayOfWeek.mode = 'unspecified'
  if (key === 'dayOfWeek' && mode !== 'unspecified') fields.dayOfMonth.mode = 'unspecified'
}

function scheduleValidation() {
  if (validateTimer) window.clearTimeout(validateTimer)
  const currentExpression = expression.value.trim()

  if (!currentExpression) {
    validating.value = false
    cronValid.value = false
    validationMessage.value = ''
    nextFireTimes.value = []
    emit('valid-change', false)
    emit('validate-message-change', '')
    return
  }

  validateTimer = window.setTimeout(() => {
    void validateAndPreview(currentExpression)
  }, 400)
}

async function validateAndPreview(value: string) {
  const sequence = ++requestSequence
  validating.value = true
  try {
    const result = await validateCronExpression(value)
    if (sequence !== requestSequence || value !== expression.value.trim()) return

    cronValid.value = result.valid
    validationMessage.value = result.valid ? '' : result.message || 'Cron 表达式不合法'
    emit('valid-change', result.valid)
    emit('validate-message-change', validationMessage.value)

    if (!result.valid) {
      nextFireTimes.value = []
      return
    }

    await loadNextFireTimes(value, sequence)
  } finally {
    if (sequence === requestSequence) validating.value = false
  }
}

async function loadNextFireTimes(value: string, sequence: number) {
  previewLoading.value = true
  try {
    const times = await previewCronNext({ expression: value, count: 5 })
    if (sequence !== requestSequence || value !== expression.value.trim()) return
    nextFireTimes.value = times
  } catch {
    if (sequence !== requestSequence || value !== expression.value.trim()) return
    nextFireTimes.value = []
    ElMessage.warning('下次运行时间计算失败')
  } finally {
    if (sequence === requestSequence) previewLoading.value = false
  }
}
</script>

<template>
  <div class="cron-editor">
    <div class="cron-editor__expression">
      <div class="cron-editor__expression-head">
        <span>Quartz Cron</span>
        <el-tag size="small" :type="statusType">{{ statusText }}</el-tag>
      </div>
      <el-input
        v-model="expression"
        :disabled="disabled"
        class="cron-editor__input"
        placeholder="例如：0 0/5 * * * ?"
      />
      <div v-if="!hasValidSegmentCount" class="cron-editor__hint">
        Quartz Cron 通常为 6 或 7 段：秒 分 时 日 月 周 [年]
      </div>
    </div>

    <el-tabs v-model="activeTab" class="cron-editor__tabs">
      <el-tab-pane label="快捷模板" name="preset">
        <div class="cron-editor__panel">
          <el-radio-group v-model="presetType" :disabled="disabled" @change="applyPreset">
            <el-radio-button label="seconds">每 N 秒</el-radio-button>
            <el-radio-button label="minutes">每 N 分钟</el-radio-button>
            <el-radio-button label="hours">每 N 小时</el-radio-button>
            <el-radio-button label="daily">每天</el-radio-button>
            <el-radio-button label="weekly">每周</el-radio-button>
            <el-radio-button label="monthly">每月</el-radio-button>
            <el-radio-button label="workday">工作日</el-radio-button>
          </el-radio-group>

          <div class="cron-editor__preset-grid">
            <el-form-item v-if="['seconds', 'minutes', 'hours'].includes(presetType)" label="间隔">
              <el-input-number
                v-model="preset.interval"
                :disabled="disabled"
                :min="1"
                :max="999"
                @change="applyPreset"
              />
            </el-form-item>
            <el-form-item
              v-if="['daily', 'weekly', 'monthly', 'workday'].includes(presetType)"
              label="小时"
            >
              <el-input-number
                v-model="preset.hour"
                :disabled="disabled"
                :min="0"
                :max="23"
                @change="applyPreset"
              />
            </el-form-item>
            <el-form-item
              v-if="['daily', 'weekly', 'monthly', 'workday'].includes(presetType)"
              label="分钟"
            >
              <el-input-number
                v-model="preset.minute"
                :disabled="disabled"
                :min="0"
                :max="59"
                @change="applyPreset"
              />
            </el-form-item>
            <el-form-item v-if="presetType === 'weekly'" label="星期">
              <el-select
                v-model="preset.weekday"
                :disabled="disabled"
                style="width: 140px"
                @change="applyPreset"
              >
                <el-option
                  v-for="option in weekdayOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="presetType === 'monthly'" label="日期">
              <el-input-number
                v-model="preset.day"
                :disabled="disabled"
                :min="1"
                :max="31"
                @change="applyPreset"
              />
            </el-form-item>
          </div>

          <el-button type="primary" :disabled="disabled" @click="applyPreset">生成表达式</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="完整字段" name="fields">
        <div class="cron-editor__fields">
          <div v-for="config in fieldConfigs" :key="config.key" class="cron-field">
            <div class="cron-field__label">
              <span>{{ config.label }}</span>
              <small>{{ config.placeholder }}</small>
            </div>
            <el-select
              :model-value="fields[config.key].mode"
              :disabled="disabled || (config.key === 'year' && !yearEnabled)"
              class="cron-field__mode"
              @update:model-value="
                config.key === 'dayOfMonth' || config.key === 'dayOfWeek'
                  ? setDayMode(config.key, $event)
                  : (fields[config.key].mode = $event)
              "
            >
              <el-option label="任意 *" value="any" />
              <el-option
                v-if="config.key === 'dayOfMonth' || config.key === 'dayOfWeek'"
                label="不指定 ?"
                value="unspecified"
              />
              <el-option label="固定值" value="value" />
              <el-option label="列表" value="list" />
              <el-option label="范围" value="range" />
              <el-option label="步长" value="step" />
              <el-option label="高级" value="advanced" />
            </el-select>

            <template v-if="config.key === 'year'">
              <el-switch v-model="yearEnabled" active-text="启用年" :disabled="disabled" />
            </template>
            <template
              v-else-if="fields[config.key].mode === 'value' || fields[config.key].mode === 'list'"
            >
              <el-input
                v-model="fields[config.key].value"
                :disabled="disabled"
                class="cron-field__input"
                :placeholder="config.placeholder"
              />
            </template>
            <template v-else-if="fields[config.key].mode === 'range'">
              <el-input
                v-model="fields[config.key].start"
                :disabled="disabled"
                class="cron-field__small"
              />
              <span class="cron-field__dash">至</span>
              <el-input
                v-model="fields[config.key].end"
                :disabled="disabled"
                class="cron-field__small"
              />
            </template>
            <template v-else-if="fields[config.key].mode === 'step'">
              <el-input
                v-model="fields[config.key].stepStart"
                :disabled="disabled"
                class="cron-field__small"
                placeholder="起始"
              />
              <span class="cron-field__dash">/</span>
              <el-input
                v-model="fields[config.key].step"
                :disabled="disabled"
                class="cron-field__small"
                placeholder="步长"
              />
            </template>
            <template v-else-if="fields[config.key].mode === 'advanced'">
              <el-input
                v-model="fields[config.key].advanced"
                :disabled="disabled"
                class="cron-field__input"
                :placeholder="config.placeholder"
              />
            </template>
          </div>

          <el-button type="primary" :disabled="disabled" @click="applyFields">应用字段</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="高级表达式" name="advanced">
        <div class="cron-editor__advanced">
          <p>
            支持后端 Quartz Cron 完整语法。复杂表达式可在这里直接编辑，合法性以后端校验结果为准。
          </p>
          <el-input
            v-model="expression"
            :disabled="disabled"
            class="cron-editor__input"
            placeholder="秒 分 时 日 月 周 [年]"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <div class="cron-editor__preview">
      <div class="cron-editor__preview-title">
        <span>下次运行时间</span>
        <el-tag v-if="previewLoading" size="small" type="warning">计算中</el-tag>
      </div>
      <el-timeline v-if="nextFireTimes.length">
        <el-timeline-item
          v-for="time in nextFireTimes"
          :key="time"
          :timestamp="formatDateTime(time)"
        />
      </el-timeline>
      <el-empty v-else :image-size="72" description="Cron 合法后自动展示接下来 5 次运行时间" />
    </div>
  </div>
</template>

<style scoped>
.cron-editor {
  width: 100%;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.08), transparent 34%), #f8fafc;
}

.cron-editor__expression {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

.cron-editor__expression-head,
.cron-editor__preview-title,
.cron-field,
.cron-editor__preset-grid {
  display: flex;
  align-items: center;
}

.cron-editor__expression-head,
.cron-editor__preview-title {
  justify-content: space-between;
  margin-bottom: 10px;
  color: #0f172a;
  font-weight: 700;
}

.cron-editor__input :deep(.el-input__inner) {
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
}

.cron-editor__hint {
  margin-top: 8px;
  color: #d97706;
  font-size: 12px;
}

.cron-editor__tabs {
  margin-top: 12px;
}

.cron-editor__panel,
.cron-editor__advanced,
.cron-editor__fields,
.cron-editor__preview {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

.cron-editor__preset-grid {
  flex-wrap: wrap;
  gap: 12px 18px;
  margin: 16px 0 4px;
}

.cron-editor__preset-grid :deep(.el-form-item) {
  margin-bottom: 12px;
}

.cron-editor__fields {
  display: grid;
  gap: 12px;
}

.cron-field {
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.cron-field:last-of-type {
  border-bottom: 0;
}

.cron-field__label {
  width: 128px;
}

.cron-field__label span,
.cron-field__label small {
  display: block;
}

.cron-field__label span {
  color: #0f172a;
  font-weight: 700;
}

.cron-field__label small {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 12px;
}

.cron-field__mode {
  width: 132px;
}

.cron-field__input {
  width: 260px;
}

.cron-field__small {
  width: 108px;
}

.cron-field__dash {
  color: #64748b;
}

.cron-editor__advanced p {
  margin: 0 0 12px;
  color: #64748b;
}

.cron-editor__preview {
  margin-top: 12px;
}

.cron-editor__preview :deep(.el-timeline) {
  padding-left: 4px;
}
</style>
