<script setup lang="ts">
import { computed, ref } from 'vue'

import type { PluginAccountListField } from '@/types/plugins'
import { resolvePluginAccountListFields } from '@/utils/pluginAccountListField'

const props = defineProps<{
  modelValue: string[]
  availableFields: PluginAccountListField[]
  maxFields: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const draggedFieldName = ref('')
const availableNames = computed(() => new Set(props.availableFields.map((field) => field.name)))
const selectedNames = computed(() => {
  const seen = new Set<string>()
  return props.modelValue.filter((name) => {
    if (!availableNames.value.has(name) || seen.has(name)) return false
    seen.add(name)
    return true
  })
})
const selectedFields = computed(() =>
  resolvePluginAccountListFields(selectedNames.value, props.availableFields),
)
const selectionLimitReached = computed(
  () => props.maxFields >= 0 && selectedNames.value.length >= props.maxFields,
)

function isSelected(name: string) {
  return selectedNames.value.includes(name)
}

function isDisabled(name: string) {
  return !isSelected(name) && selectionLimitReached.value
}

function toggleField(name: string, checked: boolean) {
  if (checked) {
    if (isSelected(name) || selectionLimitReached.value || !availableNames.value.has(name)) return
    emit('update:modelValue', [...selectedNames.value, name])
    return
  }
  emit(
    'update:modelValue',
    selectedNames.value.filter((fieldName) => fieldName !== name),
  )
}

function startDrag(name: string, event: DragEvent) {
  draggedFieldName.value = name
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', name)
}

function dropAt(targetName: string) {
  const sourceName = draggedFieldName.value
  draggedFieldName.value = ''
  if (!sourceName || sourceName === targetName) return

  const reordered = [...selectedNames.value]
  const sourceIndex = reordered.indexOf(sourceName)
  const targetIndex = reordered.indexOf(targetName)
  if (sourceIndex < 0 || targetIndex < 0) return
  reordered.splice(sourceIndex, 1)
  reordered.splice(targetIndex, 0, sourceName)
  emit('update:modelValue', reordered)
}
</script>

<template>
  <div class="column-settings">
    <section>
      <div class="column-settings__heading">
        <strong>可选字段</strong>
        <span>已选择 {{ selectedNames.length }} / {{ maxFields }}</span>
      </div>
      <el-alert
        v-if="selectionLimitReached && availableFields.some((field) => !isSelected(field.name))"
        :title="`最多可选择 ${maxFields} 个字段，已达到上限。`"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-empty v-if="availableFields.length === 0" description="当前没有可展示的插件字段" />
      <el-checkbox-group v-else class="column-settings__candidates" :model-value="selectedNames">
        <el-checkbox
          v-for="field in availableFields"
          :key="field.name"
          :value="field.name"
          :disabled="isDisabled(field.name)"
          @change="toggleField(field.name, Boolean($event))"
        >
          {{ field.label || field.name }}
          <small>{{ field.name }}</small>
        </el-checkbox>
      </el-checkbox-group>
    </section>

    <section>
      <div class="column-settings__heading">
        <strong>已选字段顺序</strong>
        <span>拖拽调整表格列顺序</span>
      </div>
      <el-empty v-if="selectedFields.length === 0" description="仅显示固定列" :image-size="64" />
      <div v-else class="column-settings__selected">
        <div
          v-for="field in selectedFields"
          :key="field.name"
          class="column-settings__selected-item"
          :class="{ 'is-dragging': draggedFieldName === field.name }"
          draggable="true"
          @dragstart="startDrag(field.name, $event)"
          @dragend="draggedFieldName = ''"
          @dragover.prevent
          @drop.prevent="dropAt(field.name)"
        >
          <span class="column-settings__drag-handle" aria-hidden="true">⋮⋮</span>
          <span>{{ field.label || field.name }}</span>
          <small>{{ field.name }}</small>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.column-settings {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
}

.column-settings section {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

.column-settings__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.column-settings__heading span,
.column-settings small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.column-settings__candidates {
  display: grid;
  gap: 4px;
  margin-top: 12px;
}

.column-settings__candidates .el-checkbox {
  width: 100%;
  margin-right: 0;
}

.column-settings__candidates small,
.column-settings__selected-item small {
  margin-left: auto;
}

.column-settings__selected {
  display: grid;
  gap: 8px;
}

.column-settings__selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  cursor: move;
  transition:
    border-color 0.2s,
    opacity 0.2s;
}

.column-settings__selected-item:hover {
  border-color: var(--el-color-primary-light-5);
}

.column-settings__selected-item.is-dragging {
  opacity: 0.5;
}

.column-settings__drag-handle {
  color: var(--el-text-color-placeholder);
  letter-spacing: -4px;
}

@media (max-width: 900px) {
  .column-settings {
    grid-template-columns: 1fr;
  }
}
</style>
