<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { getPluginConfig, updatePluginConfig } from '@/api/plugins'
import JsonEditor from '@/components/JsonEditor/JsonEditor.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PluginSchemaForm from '@/components/plugins/PluginSchemaForm.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useResourceStore } from '@/stores/resource'
import type { PluginConfigSchemaField } from '@/types/plugins'
import {
  buildSchemaModel,
  mergeConfigModel,
  parseJsonObject,
  resolveConfigSchema,
  safeParseJsonObject,
  stringifyJsonObject,
  type SchemaModel,
} from '@/utils/pluginSchemaForm'

const props = defineProps<{ installationId: string }>()
const resourceStore = useResourceStore()
const loadedInstallationId = ref('')
const configJson = ref('{}')
const jsonValid = ref(true)
const schemaValid = ref(true)
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const editorMode = ref<'form' | 'json'>('json')
const schemaFields = ref<PluginConfigSchemaField[]>([])
const schemaModel = ref<SchemaModel>({})
const originalConfigObject = ref<SchemaModel>({})
const parseFailed = ref(false)
let loadSequence = 0

const hasSchema = computed(() => schemaFields.value.length > 0)
const isCurrentInstallationLoaded = computed(
  () => loaded.value && props.installationId === loadedInstallationId.value,
)
const canSave = computed(() => {
  if (!isCurrentInstallationLoaded.value || loading.value) return false
  return editorMode.value === 'form' ? schemaValid.value && hasSchema.value : jsonValid.value
})

function resetConfigState() {
  loadedInstallationId.value = ''
  configJson.value = '{}'
  jsonValid.value = true
  schemaValid.value = true
  editorMode.value = 'json'
  schemaFields.value = []
  schemaModel.value = {}
  originalConfigObject.value = {}
  parseFailed.value = false
  loaded.value = false
}

async function load(showSuccess = false) {
  if (!props.installationId) return
  const currentInstallationId = props.installationId
  const sequence = ++loadSequence
  loading.value = true
  try {
    const config = await getPluginConfig(currentInstallationId)
    if (sequence !== loadSequence || props.installationId !== currentInstallationId) return
    configJson.value = config.configJson || '{}'
    const schema = resolveConfigSchema(config)
    schemaFields.value = schema?.fields || []
    parseFailed.value = false
    try {
      originalConfigObject.value = parseJsonObject(configJson.value)
    } catch {
      originalConfigObject.value = {}
      parseFailed.value = true
    }
    schemaModel.value = buildSchemaModel(schemaFields.value, originalConfigObject.value, 'edit')
    editorMode.value = schemaFields.value.length && !parseFailed.value ? 'form' : 'json'
    loadedInstallationId.value = currentInstallationId
    loaded.value = true
    jsonValid.value = !parseFailed.value
    schemaValid.value = true
    if (showSuccess) ElMessage.success('实例配置查询成功')
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function buildConfigJson() {
  if (editorMode.value === 'json') return configJson.value
  return stringifyJsonObject(
    mergeConfigModel(originalConfigObject.value, schemaFields.value, schemaModel.value),
  )
}

async function save() {
  if (!canSave.value) return
  const targetInstallationId = loadedInstallationId.value
  const payloadJson = buildConfigJson()
  saving.value = true
  try {
    await useConfirmAction({
      title: '保存实例配置',
      message: `确认更新安装实例「${targetInstallationId}」的独立配置？`,
      successMessage: '实例配置已保存',
      action: () => updatePluginConfig(targetInstallationId, payloadJson),
    })
    configJson.value = payloadJson
    resourceStore.invalidate('pluginConfig', 'pluginAudit')
    await load()
  } finally {
    saving.value = false
  }
}

function syncJsonFromForm() {
  if (!hasSchema.value) return
  configJson.value = stringifyJsonObject(
    mergeConfigModel(safeParseJsonObject(configJson.value), schemaFields.value, schemaModel.value),
  )
  jsonValid.value = true
}

watch(
  () => props.installationId,
  () => {
    resetConfigState()
    void load()
  },
)
watch(
  () => resourceStore.revisions.pluginConfig,
  () => {
    if (!loading.value && !saving.value) void load()
  },
)
onMounted(load)
</script>

<template>
  <section class="config-panel">
    <div class="config-toolbar">
      <div>
        <strong>实例配置</strong>
        <small>缓存与表单状态仅属于当前 installationId。</small>
      </div>
      <div>
        <PermissionGuard permission="plugin:config:write">
          <el-button type="primary" :loading="saving" :disabled="!canSave" @click="save"
            >保存配置</el-button
          >
        </PermissionGuard>
        <el-button :loading="loading" @click="load(true)">刷新</el-button>
      </div>
    </div>
    <el-skeleton v-if="loading && !loaded" animated :rows="8" />
    <template v-else-if="isCurrentInstallationLoaded">
      <el-alert
        v-if="parseFailed"
        title="当前配置 JSON 无法解析，请修正后再保存。"
        type="warning"
        :closable="false"
      />
      <el-alert
        v-else-if="!hasSchema"
        title="当前实例未提供配置 Schema，使用高级 JSON 模式。"
        type="info"
        :closable="false"
      />
      <el-tabs v-if="hasSchema && !parseFailed" v-model="editorMode" @tab-change="syncJsonFromForm">
        <el-tab-pane label="表单配置" name="form">
          <PluginSchemaForm
            v-model="schemaModel"
            mode="config"
            :fields="schemaFields"
            @valid-change="schemaValid = $event"
          />
        </el-tab-pane>
        <el-tab-pane label="高级 JSON" name="json"
          ><JsonEditor v-model="configJson" :rows="20" @valid-change="jsonValid = $event"
        /></el-tab-pane>
      </el-tabs>
      <JsonEditor v-else v-model="configJson" :rows="20" @valid-change="jsonValid = $event" />
    </template>
  </section>
</template>

<style scoped>
.config-panel,
.config-toolbar > div:first-child {
  display: grid;
  gap: 12px;
}

.config-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-toolbar small {
  color: var(--el-text-color-secondary);
}
</style>
