<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { listPluginDefinitions } from '@/api/plugins'
import { useResourceStore } from '@/stores/resource'
import type { PluginDefinitionResponse } from '@/types/plugins'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '请选择全局插件包',
    disabled: false,
    clearable: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const resourceStore = useResourceStore()
const loading = ref(false)
const definitions = ref<PluginDefinitionResponse[]>([])
let loadSequence = 0

async function load(keyword = '') {
  const sequence = ++loadSequence
  loading.value = true
  try {
    const response = await listPluginDefinitions({ page: 1, size: 30, keyword })
    if (sequence !== loadSequence) return
    definitions.value = response.items
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function update(value?: string) {
  emit('update:modelValue', value || '')
}

onMounted(() => load(props.modelValue))
watch(
  () => resourceStore.revisions.pluginDefinitions,
  () => load(props.modelValue),
)
</script>

<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :loading="loading"
    filterable
    remote
    style="width: 100%"
    @update:model-value="update"
    @remote-method="load"
  >
    <el-option
      v-for="definition in definitions"
      :key="definition.pluginId"
      :value="definition.pluginId"
      :label="`${definition.displayName || definition.pluginId} / ${definition.pluginId} / v${definition.version}`"
    />
  </el-select>
</template>
