<script setup lang="ts">
import { computed } from 'vue'

import type { PluginAccountListField } from '@/types/plugins'
import {
  formatPluginAccountListValue,
  normalizePluginAccountBoolean,
  normalizePluginAccountMultiSelect,
} from '@/utils/pluginAccountListField'

const props = defineProps<{
  field: PluginAccountListField
  value?: unknown
}>()

const formattedValue = computed(() => formatPluginAccountListValue(props.field, props.value))
const booleanValue = computed(() => normalizePluginAccountBoolean(props.value))
const multiSelectValues = computed(() => normalizePluginAccountMultiSelect(props.value))
</script>

<template>
  <template
    v-if="field.type === 'MULTI_SELECT' || (field.type === 'CHECKBOX' && Array.isArray(value))"
  >
    <div v-if="multiSelectValues.length" class="account-list-tags">
      <el-tag v-for="(item, index) in multiSelectValues" :key="`${item}-${index}`" type="info">
        {{ item }}
      </el-tag>
    </div>
    <span v-else>{{ formattedValue }}</span>
  </template>

  <template v-else-if="field.type === 'SWITCH' || field.type === 'CHECKBOX'">
    <el-tag v-if="booleanValue !== undefined" :type="booleanValue ? 'success' : 'info'">
      {{ field.type === 'SWITCH' ? (booleanValue ? '启用' : '停用') : booleanValue ? '是' : '否' }}
    </el-tag>
    <span v-else>{{ formattedValue }}</span>
  </template>

  <span v-else class="account-list-text">{{ formattedValue }}</span>
</template>

<style scoped>
.account-list-text {
  display: inline;
}

.account-list-tags {
  display: flex;
  min-width: 0;
  flex-wrap: nowrap;
  gap: 4px;
}

.account-list-tags .el-tag {
  flex: 0 0 auto;
}
</style>
