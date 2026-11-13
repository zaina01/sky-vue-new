<script setup lang="ts">
import { computed } from 'vue'

import type { PluginFieldSchema } from '@/types/plugins'
import {
  createSchemaObjectListRow,
  formatSchemaPath,
  getObjectListSchemaError,
  getSchemaRowKey,
  getSchemaValueAtPath,
  objectListSchemaFields,
  visibleSchemaFields,
  type SchemaModel,
  type SchemaPath,
} from '@/utils/pluginSchemaForm'

defineOptions({ name: 'PluginSchemaField' })

interface MapRow {
  key: string
  value: string
}

const props = withDefaults(
  defineProps<{
    field: PluginFieldSchema
    rootModel: SchemaModel
    path: SchemaPath
    mode: 'config' | 'account'
    submitMode: 'create' | 'edit'
    accountIdField?: string
    errors: Map<string, string>
    objectListDepth?: number
    inheritedDisabled?: boolean
    setValue: (path: SchemaPath, value: unknown) => void
  }>(),
  {
    accountIdField: '',
    objectListDepth: 0,
    inheritedDisabled: false,
  },
)

const pathKey = computed(() => formatSchemaPath(props.path))
const fieldValue = computed(() => getSchemaValueAtPath(props.rootModel, props.path))
const currentObjectListDepth = computed(() =>
  props.field.type === 'OBJECT_LIST' ? props.objectListDepth + 1 : props.objectListDepth,
)
const objectListError = computed(() =>
  props.field.type === 'OBJECT_LIST'
    ? getObjectListSchemaError(props.field, currentObjectListDepth.value, props.path)
    : '',
)
const fieldError = computed(() => (objectListError.value ? '' : props.errors.get(pathKey.value)))
const childFields = computed(() => objectListSchemaFields(props.field))
const fieldDisabled = computed(() => {
  if (props.inheritedDisabled) return true
  if (props.mode !== 'account' || props.submitMode !== 'edit') return false
  const isRootAccountId =
    props.path.length === 1 && props.path[0] === (props.accountIdField || props.field.name)
  return Boolean(
    props.field.readonly || props.field.accountId || (props.accountIdField && isRootAccountId),
  )
})

function isWideField(field: PluginFieldSchema) {
  if (field.type === 'LIST' || field.type === 'MAP' || field.type === 'OBJECT_LIST') return true
  return (field.type === 'RADIO' || field.type === 'CHECKBOX') && (field.options?.length || 0) > 4
}

function isCompactField(field: PluginFieldSchema) {
  return ['SWITCH', 'NUMBER', 'DATE', 'TIME', 'DATETIME'].includes(field.type)
}

function optionLabel(option: { label?: string; value: string | number | boolean }) {
  return option.label || String(option.value)
}

function placeholder(field: PluginFieldSchema) {
  if (props.mode === 'account' && field.sensitive && props.submitMode === 'edit') {
    return '留空表示不修改'
  }
  return `请输入${field.label || field.name}`
}

function asString(value: unknown) {
  return typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : String(value)
}

function asBoolean(value: unknown) {
  return Boolean(value)
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function asNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function asDateTimeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asMapRows(value: unknown): MapRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => ({
    key,
    value: asString(item),
  }))
}

function asObjectListRows(value: unknown): SchemaModel[] {
  if (!Array.isArray(value)) return []
  return value.map((item) =>
    item && typeof item === 'object' && !Array.isArray(item) ? (item as SchemaModel) : {},
  )
}

function setCurrentValue(value: unknown) {
  props.setValue(props.path, value)
}

function visibleChildren(row: SchemaModel) {
  return visibleSchemaFields(childFields.value, row)
}

function addObjectListRow() {
  setCurrentValue([
    ...asObjectListRows(fieldValue.value),
    createSchemaObjectListRow(childFields.value),
  ])
}

function removeObjectListRow(index: number) {
  setCurrentValue(asObjectListRows(fieldValue.value).filter((_row, rowIndex) => rowIndex !== index))
}

function addListItem() {
  setCurrentValue([...asArray(fieldValue.value), ''])
}

function updateListItem(index: number, value: string) {
  const list = [...asArray(fieldValue.value)]
  list[index] = value
  setCurrentValue(list)
}

function removeListItem(index: number) {
  setCurrentValue(asArray(fieldValue.value).filter((_item, itemIndex) => itemIndex !== index))
}

function mapRowsToObject(rows: MapRow[]) {
  return rows.reduce<Record<string, string>>((map, row) => {
    if (row.key) map[row.key] = row.value
    return map
  }, {})
}

function addMapItem() {
  setCurrentValue(mapRowsToObject([...asMapRows(fieldValue.value), { key: '', value: '' }]))
}

function updateMapItem(index: number, key: keyof MapRow, value: string) {
  const rows = asMapRows(fieldValue.value)
  rows[index] = { ...rows[index], [key]: value }
  setCurrentValue(mapRowsToObject(rows))
}

function removeMapItem(index: number) {
  setCurrentValue(
    mapRowsToObject(asMapRows(fieldValue.value).filter((_item, itemIndex) => itemIndex !== index)),
  )
}
</script>

<template>
  <el-form-item
    class="plugin-schema-form__field"
    :class="{
      'plugin-schema-form__field--wide': isWideField(field),
      'plugin-schema-form__field--compact': isCompactField(field),
    }"
    :data-field-path="pathKey"
    :label="field.label || field.name"
    :required="field.required"
    :error="fieldError"
  >
    <el-switch
      v-if="field.type === 'SWITCH'"
      :model-value="asBoolean(fieldValue)"
      :disabled="fieldDisabled"
      @update:model-value="setCurrentValue"
    />

    <el-radio-group
      v-else-if="field.type === 'RADIO'"
      :model-value="fieldValue"
      :disabled="fieldDisabled"
      @update:model-value="setCurrentValue"
    >
      <el-radio
        v-for="option in field.options || []"
        :key="String(option.value)"
        :label="option.value"
      >
        {{ optionLabel(option) }}
      </el-radio>
    </el-radio-group>

    <el-select
      v-else-if="field.type === 'SELECT'"
      :model-value="fieldValue"
      clearable
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      style="width: 100%"
      @update:model-value="setCurrentValue"
    >
      <el-option
        v-for="option in field.options || []"
        :key="String(option.value)"
        :label="optionLabel(option)"
        :value="option.value"
      />
    </el-select>

    <el-checkbox-group
      v-else-if="field.type === 'CHECKBOX'"
      :model-value="asArray(fieldValue)"
      :disabled="fieldDisabled"
      @update:model-value="setCurrentValue"
    >
      <el-checkbox
        v-for="option in field.options || []"
        :key="String(option.value)"
        :label="option.value"
      >
        {{ optionLabel(option) }}
      </el-checkbox>
    </el-checkbox-group>

    <el-select
      v-else-if="field.type === 'MULTI_SELECT'"
      :model-value="asArray(fieldValue)"
      multiple
      clearable
      collapse-tags
      collapse-tags-tooltip
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      style="width: 100%"
      @update:model-value="setCurrentValue"
    >
      <el-option
        v-for="option in field.options || []"
        :key="String(option.value)"
        :label="optionLabel(option)"
        :value="option.value"
      />
    </el-select>

    <div v-else-if="field.type === 'LIST'" class="plugin-schema-form__list">
      <div
        v-for="(_item, index) in asArray(fieldValue)"
        :key="index"
        class="plugin-schema-form__inline-row"
      >
        <el-input
          :model-value="asString(asArray(fieldValue)[index])"
          :disabled="fieldDisabled"
          @update:model-value="updateListItem(index, $event)"
        />
        <el-button :disabled="fieldDisabled" @click="removeListItem(index)">删除</el-button>
      </div>
      <el-button :disabled="fieldDisabled" @click="addListItem">添加一项</el-button>
    </div>

    <div v-else-if="field.type === 'MAP'" class="plugin-schema-form__list">
      <div
        v-for="(row, index) in asMapRows(fieldValue)"
        :key="index"
        class="plugin-schema-form__map-row"
      >
        <el-input
          :model-value="row.key"
          placeholder="Key"
          :disabled="fieldDisabled"
          @update:model-value="updateMapItem(index, 'key', $event)"
        />
        <el-input
          :model-value="row.value"
          placeholder="Value"
          :disabled="fieldDisabled"
          @update:model-value="updateMapItem(index, 'value', $event)"
        />
        <el-button :disabled="fieldDisabled" @click="removeMapItem(index)">删除</el-button>
      </div>
      <el-button :disabled="fieldDisabled" @click="addMapItem">添加键值</el-button>
    </div>

    <div
      v-else-if="field.type === 'OBJECT_LIST'"
      class="plugin-schema-form__object-list"
      :data-object-list-path="pathKey"
    >
      <el-alert
        v-if="objectListError"
        :title="objectListError"
        type="error"
        :closable="false"
        show-icon
      />
      <template v-else>
        <section
          v-for="(row, rowIndex) in asObjectListRows(fieldValue)"
          :key="getSchemaRowKey(row)"
          class="plugin-schema-form__object-row"
          :data-object-list-row-path="pathKey"
          :data-row-key="getSchemaRowKey(row)"
        >
          <div class="plugin-schema-form__object-row-header">
            <span>第 {{ rowIndex + 1 }} 项</span>
            <el-button
              type="danger"
              link
              :disabled="fieldDisabled"
              @click="removeObjectListRow(rowIndex)"
            >
              删除
            </el-button>
          </div>

          <div
            class="plugin-schema-form__object-fields plugin-schema-form__object-fields--grid"
            :class="{ 'plugin-schema-form__object-fields--account': mode === 'account' }"
          >
            <PluginSchemaField
              v-for="child in visibleChildren(row)"
              :key="child.name"
              :field="child"
              :root-model="rootModel"
              :path="[...path, rowIndex, child.name]"
              :mode="mode"
              :submit-mode="submitMode"
              :account-id-field="accountIdField"
              :errors="errors"
              :object-list-depth="currentObjectListDepth"
              :inherited-disabled="fieldDisabled"
              :set-value="setValue"
            />
          </div>
        </section>

        <el-button :disabled="fieldDisabled" @click="addObjectListRow">添加一项</el-button>
      </template>
    </div>

    <el-input-number
      v-else-if="field.type === 'NUMBER'"
      :model-value="asNumber(fieldValue)"
      :disabled="fieldDisabled"
      @update:model-value="setCurrentValue"
    />

    <el-date-picker
      v-else-if="field.type === 'DATE'"
      :model-value="asDateTimeString(fieldValue)"
      type="date"
      value-format="YYYY-MM-DD"
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      style="width: 100%"
      @update:model-value="setCurrentValue($event || '')"
    />

    <el-time-picker
      v-else-if="field.type === 'TIME'"
      :model-value="asDateTimeString(fieldValue)"
      value-format="HH:mm:ss"
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      style="width: 100%"
      @update:model-value="setCurrentValue($event || '')"
    />

    <el-date-picker
      v-else-if="field.type === 'DATETIME'"
      :model-value="asDateTimeString(fieldValue)"
      type="datetime"
      value-format="YYYY-MM-DD HH:mm:ss"
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      style="width: 100%"
      @update:model-value="setCurrentValue($event || '')"
    />

    <el-input
      v-else
      :model-value="asString(fieldValue)"
      :type="field.type === 'PASSWORD' || field.sensitive ? 'password' : 'text'"
      :show-password="field.type === 'PASSWORD' || Boolean(field.sensitive)"
      :placeholder="placeholder(field)"
      :disabled="fieldDisabled"
      @update:model-value="setCurrentValue"
    />
  </el-form-item>
</template>

<style scoped>
.plugin-schema-form__field :deep(.el-form-item__content) {
  min-width: 0;
}

.plugin-schema-form__list {
  container: plugin-list / inline-size;
  display: grid;
  width: 100%;
  gap: 10px;
}

.plugin-schema-form__list > .el-button,
.plugin-schema-form__object-list > .el-button {
  justify-self: start;
}

.plugin-schema-form__inline-row,
.plugin-schema-form__map-row {
  display: grid;
  gap: 8px;
}

.plugin-schema-form__inline-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.plugin-schema-form__map-row {
  grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr) auto;
}

.plugin-schema-form__object-list {
  display: grid;
  width: 100%;
  gap: 12px;
}

.plugin-schema-form__object-row {
  container: plugin-object / inline-size;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.plugin-schema-form__object-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-radius: 10px 10px 0 0;
  background: var(--el-fill-color-extra-light);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
}

.plugin-schema-form__object-fields {
  padding: 12px;
}

.plugin-schema-form__object-fields--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px 14px;
  align-items: start;
}

.plugin-schema-form__object-fields--account {
  grid-template-columns: minmax(0, 1fr);
}

.plugin-schema-form__object-fields--grid > :deep(.el-form-item) {
  min-width: 0;
  margin: 0;
}

.plugin-schema-form__object-fields--grid > :deep(.plugin-schema-form__field--wide) {
  grid-column: 1 / -1;
}

@container plugin-list (max-width: 480px) {
  .plugin-schema-form__map-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .plugin-schema-form__map-row > .el-button {
    justify-self: start;
  }
}

@container plugin-object (min-width: 640px) {
  .plugin-schema-form__object-fields--account {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container plugin-schema (min-width: 1100px) {
  .plugin-schema-form__object-fields--grid:not(.plugin-schema-form__object-fields--account) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
