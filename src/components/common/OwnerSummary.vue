<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  ownerUserId?: string | null
  ownerUsername?: string | null
  ownerDepartmentId?: number | null
  ownerDepartmentName?: string | null
  compact?: boolean
}>()

const userText = computed(() => {
  if (props.ownerUsername) return props.ownerUsername
  if (props.ownerUserId) return `用户 ${props.ownerUserId}`
  return '-'
})

const departmentText = computed(() => {
  if (props.ownerDepartmentName) return props.ownerDepartmentName
  if (props.ownerDepartmentId !== undefined && props.ownerDepartmentId !== null) {
    return `部门 ${props.ownerDepartmentId}`
  }
  return '-'
})
</script>

<template>
  <span v-if="compact" class="owner-summary owner-summary--compact">
    {{ userText }} / {{ departmentText }}
  </span>
  <span v-else class="owner-summary">
    <span>{{ userText }}</span>
    <small>{{ departmentText }}</small>
  </span>
</template>

<style scoped>
.owner-summary {
  display: inline-grid;
  gap: 2px;
  min-width: 0;
}

.owner-summary small {
  color: var(--el-text-color-secondary);
}

.owner-summary--compact {
  display: inline;
}
</style>
