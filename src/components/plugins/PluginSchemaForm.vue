<script setup lang="ts">
import { computed, watch } from 'vue'

import PluginSchemaField from '@/components/plugins/PluginSchemaField.vue'
import type { PluginFieldSchema } from '@/types/plugins'
import {
  updateSchemaValueAtPath,
  validateSchemaModel,
  visibleSchemaFields,
  type SchemaModel,
  type SchemaPath,
} from '@/utils/pluginSchemaForm'

const props = withDefaults(
  defineProps<{
    modelValue: SchemaModel
    fields: PluginFieldSchema[]
    mode: 'config' | 'account'
    submitMode?: 'create' | 'edit'
    accountIdField?: string
  }>(),
  {
    submitMode: 'create',
    accountIdField: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: SchemaModel]
  'valid-change': [value: boolean]
}>()

const visibleFields = computed(() => visibleSchemaFields(props.fields, props.modelValue))
const fieldErrors = computed(() =>
  validateSchemaModel(props.fields, props.modelValue, {
    mode: props.mode,
    submitMode: props.submitMode,
  }),
)
const valid = computed(() => fieldErrors.value.size === 0)

function setValue(path: SchemaPath, value: unknown) {
  emit('update:modelValue', updateSchemaValueAtPath(props.modelValue, path, value))
}

watch(
  valid,
  (value) => {
    emit('valid-change', value)
  },
  { immediate: true },
)
</script>

<template>
  <div
    class="plugin-schema-form plugin-schema-form--stacked"
    :class="{ 'plugin-schema-form--account': mode === 'account' }"
  >
    <el-alert
      v-if="mode === 'account' && submitMode === 'edit'"
      title="敏感字段留空表示不修改；只读字段和账号 ID 字段在编辑时不可修改。"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 14px"
    />

    <el-form class="plugin-schema-form__grid" label-position="top">
      <PluginSchemaField
        v-for="field in visibleFields"
        :key="field.name"
        :field="field"
        :root-model="modelValue"
        :path="[field.name]"
        :mode="mode"
        :submit-mode="submitMode"
        :account-id-field="accountIdField"
        :errors="fieldErrors"
        :set-value="setValue"
      />
    </el-form>
  </div>
</template>

<style scoped>
.plugin-schema-form {
  container-type: inline-size;
  container-name: plugin-schema;
}

.plugin-schema-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
  align-items: start;
}

.plugin-schema-form--account .plugin-schema-form__grid {
  grid-template-columns: minmax(0, 1fr);
}

.plugin-schema-form__grid > :deep(.el-form-item) {
  min-width: 0;
  margin: 0;
  padding: 14px 16px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--el-bg-color), var(--el-fill-color-extra-light));
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.plugin-schema-form__grid > :deep(.el-form-item:hover) {
  border-color: var(--el-border-color);
}

.plugin-schema-form__grid > :deep(.el-form-item:focus-within) {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

.plugin-schema-form__grid > :deep(.plugin-schema-form__field--wide) {
  grid-column: 1 / -1;
}

:deep(.plugin-schema-form__field--compact .el-input-number),
:deep(.plugin-schema-form__field--compact .el-date-editor) {
  width: 100%;
  max-width: 280px;
}

.plugin-schema-form--stacked :deep(.el-form-item) {
  align-items: stretch;
}

.plugin-schema-form--stacked :deep(.el-form-item__label) {
  display: block;
  width: 100%;
  height: auto;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.plugin-schema-form--stacked :deep(.el-form-item__content) {
  min-width: 0;
}

.plugin-schema-form__grid :deep(.el-input-number) {
  width: 100%;
}

.plugin-schema-form__grid :deep(.el-radio-group),
.plugin-schema-form__grid :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  gap: 8px 16px;
}

.plugin-schema-form__grid :deep(.el-radio),
.plugin-schema-form__grid :deep(.el-checkbox) {
  max-width: 100%;
  height: auto;
  min-height: 32px;
  margin-right: 0;
}

.plugin-schema-form__grid :deep(.el-radio__label),
.plugin-schema-form__grid :deep(.el-checkbox__label) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.plugin-schema-form__grid :deep(.el-form-item__error) {
  position: static;
  width: 100%;
  padding-top: 6px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@container plugin-schema (min-width: 640px) {
  .plugin-schema-form--account .plugin-schema-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container plugin-schema (min-width: 1220px) {
  .plugin-schema-form:not(.plugin-schema-form--account) .plugin-schema-form__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
