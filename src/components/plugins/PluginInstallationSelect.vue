<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { listPluginOptions } from '@/api/plugins'
import { useResourceStore } from '@/stores/resource'
import type { PluginOptionItem, PluginOptionUsage, PluginRuntimeState } from '@/types/plugins'

type InstallationOption = Partial<PluginOptionItem> & Pick<PluginOptionItem, 'installationId'>

const props = withDefaults(
  defineProps<{
    modelValue?: string
    usage?: PluginOptionUsage
    state?: PluginRuntimeState | ''
    placeholder?: string
    width?: string
    clearable?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    usage: undefined,
    state: '',
    placeholder: '请选择插件安装实例',
    width: '320px',
    clearable: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  select: [option: InstallationOption | undefined]
}>()

const resourceStore = useResourceStore()
const loading = ref(false)
const options = ref<InstallationOption[]>([])
const keyword = ref('')
let loadSequence = 0
const selectStyle = computed(() => ({ width: props.width }))

function shortInstallationId(value: string) {
  return value.length > 10 ? value.slice(0, 8) : value
}

function optionLabel(option: InstallationOption) {
  const department =
    option.ownerDepartmentId === null || option.ownerDepartmentId === undefined
      ? '无部门'
      : `部门 ${option.ownerDepartmentId}`
  return [
    option.installationName || option.pluginName || option.pluginId || '安装实例',
    option.pluginName || option.pluginId,
    department,
    shortInstallationId(option.installationId),
  ]
    .filter(Boolean)
    .join(' / ')
}

function ensureSelectedOption() {
  if (!props.modelValue) return
  if (options.value.some((option) => option.installationId === props.modelValue)) return
  options.value = [{ installationId: props.modelValue }, ...options.value]
}

function stateLabel(state?: string) {
  if (state === 'RUNNING') return '运行中'
  if (state === 'STARTING') return '启动中'
  if (state === 'STOPPED') return '已停止'
  if (state === 'FAILED') return '异常'
  return state || '未知'
}

function stateTagType(state?: string) {
  if (state === 'RUNNING') return 'success'
  if (state === 'STARTING') return 'warning'
  if (state === 'FAILED') return 'danger'
  return 'info'
}

async function loadOptions(value = '') {
  const sequence = ++loadSequence
  keyword.value = value
  loading.value = true
  try {
    const response = await listPluginOptions({
      page: 1,
      size: 30,
      keyword: value,
      usage: props.usage || '',
      state: props.state || '',
    })
    if (sequence !== loadSequence) return
    options.value = response.items
    ensureSelectedOption()
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function handleChange(value?: string) {
  const normalized = value || ''
  emit('update:modelValue', normalized)
  emit('change', normalized)
  emit(
    'select',
    options.value.find((option) => option.installationId === normalized),
  )
}

onMounted(() => loadOptions(props.modelValue))
watch(() => props.modelValue, ensureSelectedOption)
watch(
  () => [props.usage, props.state],
  () => loadOptions(keyword.value),
)
watch(
  () => resourceStore.revisions.pluginInstallations,
  () => loadOptions(keyword.value),
)
</script>

<template>
  <el-select
    :model-value="modelValue"
    :style="selectStyle"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :loading="loading"
    :remote-method="loadOptions"
    filterable
    remote
    reserve-keyword
    remote-show-suffix
    @update:model-value="handleChange"
  >
    <el-option
      v-for="option in options"
      :key="option.installationId"
      :label="optionLabel(option)"
      :value="option.installationId"
    >
      <div class="installation-option">
        <div>
          <strong>{{ option.installationName || option.pluginName || '安装实例' }}</strong>
          <small>{{ option.pluginName || option.pluginId || option.installationId }}</small>
        </div>
        <div class="installation-option__meta">
          <el-tag v-if="option.state" :type="stateTagType(option.state)" size="small">
            {{ stateLabel(option.state) }}
          </el-tag>
          <span>{{ shortInstallationId(option.installationId) }}</span>
        </div>
      </div>
    </el-option>
  </el-select>
</template>

<style scoped>
.installation-option,
.installation-option__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.installation-option {
  justify-content: space-between;
  width: 100%;
}

.installation-option > div:first-child {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}

.installation-option small,
.installation-option__meta span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
