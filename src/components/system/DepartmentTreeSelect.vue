<script setup lang="ts">
import { computed } from 'vue'

import type { DepartmentResponse } from '@/types/system'

const props = withDefaults(
  defineProps<{
    modelValue: number | null | number[] | '' | undefined
    departments: DepartmentResponse[]
    multiple?: boolean
    onlyEnabled?: boolean
    preserveDisabledSelection?: boolean
    blockedIds?: number[]
    placeholder?: string
    disabled?: boolean
    emptyValue?: null | ''
  }>(),
  {
    multiple: false,
    onlyEnabled: false,
    preserveDisabledSelection: false,
    blockedIds: () => [],
    placeholder: '请选择部门',
    disabled: false,
    emptyValue: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null | number[] | '']
}>()

const selectedIds = computed(() => {
  if (Array.isArray(props.modelValue)) return new Set(props.modelValue)
  return new Set(typeof props.modelValue === 'number' ? [props.modelValue] : [])
})

const treeData = computed(() => {
  const blocked = new Set(props.blockedIds)
  const mapNode = (department: DepartmentResponse): Record<string, unknown> => ({
    value: department.departmentId,
    label: `${department.departmentName}${department.enabled ? '' : '（已停用）'}`,
    disabled:
      blocked.has(department.departmentId) ||
      (props.onlyEnabled &&
        !department.enabled &&
        !(props.preserveDisabledSelection && selectedIds.value.has(department.departmentId))),
    children: department.children.map(mapNode),
  })
  return props.departments.map(mapNode)
})

function updateValue(value: number | number[] | null | undefined) {
  if (props.multiple) {
    emit('update:modelValue', Array.isArray(value) ? value : [])
  } else {
    emit('update:modelValue', typeof value === 'number' ? value : props.emptyValue)
  }
}
</script>

<template>
  <el-tree-select
    :model-value="modelValue"
    :data="treeData"
    :multiple="multiple"
    :disabled="disabled"
    :placeholder="placeholder"
    :check-strictly="true"
    :render-after-expand="false"
    clearable
    filterable
    default-expand-all
    style="width: 100%"
    @update:model-value="updateValue"
  />
</template>
