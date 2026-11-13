<script setup lang="ts">
import { computed } from 'vue'

import { useUserStore } from '@/stores/user'
import { hasAllPermissions, hasAnyPermission, hasPermission } from '@/utils/permission'

const props = withDefaults(
  defineProps<{
    permission?: string
    permissions?: string[]
    mode?: 'any' | 'all'
  }>(),
  {
    permission: undefined,
    permissions: () => [],
    mode: 'any',
  },
)

const userStore = useUserStore()

const allowed = computed(() => {
  if (props.permission) return hasPermission(userStore.permissions, props.permission)
  if (props.mode === 'all') return hasAllPermissions(userStore.permissions, props.permissions)
  return hasAnyPermission(userStore.permissions, props.permissions)
})
</script>

<template>
  <slot v-if="allowed" />
</template>
