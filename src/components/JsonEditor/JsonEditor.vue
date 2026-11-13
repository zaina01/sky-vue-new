<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    rows?: number
    readonly?: boolean
  }>(),
  {
    rows: 12,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  validChange: [value: boolean]
}>()

const localValue = ref(props.modelValue)
const error = ref('')

const valid = computed(() => !error.value)

function validate(value: string) {
  if (!value.trim()) {
    error.value = ''
    emit('validChange', true)
    return
  }

  try {
    JSON.parse(value)
    error.value = ''
    emit('validChange', true)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : 'JSON 格式错误'
    emit('validChange', false)
  }
}

function updateValue(value: string) {
  localValue.value = value
  emit('update:modelValue', value)
  validate(value)
}

function formatJson() {
  if (!localValue.value.trim()) return
  const formatted = JSON.stringify(JSON.parse(localValue.value), null, 2)
  updateValue(formatted)
}

watch(
  () => props.modelValue,
  (value) => {
    localValue.value = value
    validate(value)
  },
  { immediate: true },
)
</script>

<template>
  <div class="json-editor">
    <div class="json-editor__toolbar">
      <el-tag :type="valid ? 'success' : 'danger'">{{ valid ? 'JSON 有效' : 'JSON 错误' }}</el-tag>
      <el-button size="small" :disabled="readonly || !valid" @click="formatJson">格式化</el-button>
    </div>
    <el-input
      :model-value="localValue"
      type="textarea"
      :rows="rows"
      :readonly="readonly"
      spellcheck="false"
      class="json-editor__input"
      @update:model-value="updateValue"
    />
    <p v-if="error" class="json-editor__error">{{ error }}</p>
  </div>
</template>
