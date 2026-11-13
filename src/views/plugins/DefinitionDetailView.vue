<script setup lang="ts">
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadFile,
  type UploadInstance,
} from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  deletePluginDefinition,
  getPluginDefinition,
  installPluginDependencies,
  listLocalPluginDependencyArtifacts,
  listPluginDependencies,
  reinstallPluginDependencies,
  uninstallPluginDependencies,
  uploadLocalPluginDependencyArtifact,
} from '@/api/plugins'
import PageBackButton from '@/components/PageBackButton/PageBackButton.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type {
  LocalPluginDependencyArtifact,
  LocalPluginDependencyArtifactQuery,
  PluginDefinitionResponse,
  PluginDependency,
  PluginDependencyInstallMode,
} from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const resourceStore = useResourceStore()
const definition = ref<PluginDefinitionResponse>()
const dependencies = ref<PluginDependency[]>([])
const loading = ref(false)
const dependencyLoading = ref(false)
const installVisible = ref(false)
const installing = ref(false)
const dependencyText = ref('')
const installMode = ref<PluginDependencyInstallMode>('merge')
const installSource = ref<'coordinates' | 'local'>('coordinates')
const localArtifactsLoaded = ref(false)
const selectedLocalCoordinates = ref(new Set<string>())
const localUploadVisible = ref(false)
const localUploading = ref(false)
const localUploadFile = ref<File>()
const localUploadRef = ref<UploadInstance>()
const localUploadFormRef = ref<FormInstance>()
const localUploadForm = reactive({ groupId: '', artifactId: '', version: '' })
const localUploadRules: FormRules<typeof localUploadForm> = {
  groupId: [{ required: true, message: '请输入 Group ID', trigger: 'blur' }],
  artifactId: [{ required: true, message: '请输入 Artifact ID', trigger: 'blur' }],
  version: [{ required: true, message: '请输入版本', trigger: 'blur' }],
}
const localArtifactTable = usePagination<
  LocalPluginDependencyArtifact,
  Omit<LocalPluginDependencyArtifactQuery, 'page' | 'size'>
>({ keyword: '' }, (params) => listLocalPluginDependencyArtifacts(params))
const pluginId = computed(() => String(route.params.pluginId || ''))
const parsedDependencies = computed(() =>
  Array.from(
    new Set(
      dependencyText.value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ),
)
const installDependencies = computed(() =>
  installSource.value === 'coordinates'
    ? parsedDependencies.value
    : [...selectedLocalCoordinates.value],
)

function coordinate(row: PluginDependency) {
  return [row.groupId, row.artifactId, row.version].join(':')
}

function formatFileSize(value?: number | null) {
  if (!value) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function openInstallDialog() {
  installSource.value = 'coordinates'
  installVisible.value = true
}

async function handleInstallSourceChange(value: string | number) {
  if (value !== 'local' || localArtifactsLoaded.value) return
  await localArtifactTable.load()
  localArtifactsLoaded.value = true
}

function searchLocalArtifacts() {
  localArtifactTable.page.value = 1
  return localArtifactTable.load()
}

function toggleLocalArtifact(coordinateValue: string, checked: boolean) {
  const next = new Set(selectedLocalCoordinates.value)
  if (checked) next.add(coordinateValue)
  else next.delete(coordinateValue)
  selectedLocalCoordinates.value = next
}

function resetLocalUpload() {
  Object.assign(localUploadForm, { groupId: '', artifactId: '', version: '' })
  localUploadFile.value = undefined
  localUploadRef.value?.clearFiles()
  localUploadFormRef.value?.clearValidate()
}

function openLocalUpload() {
  resetLocalUpload()
  localUploadVisible.value = true
}

function handleLocalFileChange(file: UploadFile) {
  localUploadFile.value = file.raw
}

function handleLocalFileRemove() {
  localUploadFile.value = undefined
}

async function uploadLocalArtifact(installAfterUpload: boolean) {
  const valid = await localUploadFormRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!localUploadFile.value) {
    ElMessage.warning('请选择本地依赖文件')
    return
  }

  localUploading.value = true
  try {
    const artifact = await uploadLocalPluginDependencyArtifact({
      file: localUploadFile.value,
      groupId: localUploadForm.groupId.trim(),
      artifactId: localUploadForm.artifactId.trim(),
      version: localUploadForm.version.trim(),
    })
    const next = new Set(selectedLocalCoordinates.value)
    next.add(artifact.coordinate)
    selectedLocalCoordinates.value = next
    localArtifactsLoaded.value = true
    await localArtifactTable.load()

    if (installAfterUpload) {
      const result = await installPluginDependencies(pluginId.value, {
        dependencies: [artifact.coordinate],
        mode: installMode.value,
      })
      dependencies.value = result.dependencies
      resourceStore.invalidate('pluginDefinitions')
      installVisible.value = false
      ElMessage.success('本地依赖已上传并安装到当前插件定义')
    } else {
      ElMessage.success('本地依赖已上传，并已在列表中选中')
    }
    localUploadVisible.value = false
    resetLocalUpload()
  } finally {
    localUploading.value = false
  }
}

async function load() {
  loading.value = true
  dependencyLoading.value = true
  try {
    const [definitionResult, dependencyResult] = await Promise.all([
      getPluginDefinition(pluginId.value),
      listPluginDependencies(pluginId.value),
    ])
    definition.value = definitionResult
    dependencies.value = dependencyResult
  } finally {
    loading.value = false
    dependencyLoading.value = false
  }
}

async function install() {
  if (!installDependencies.value.length) return
  installing.value = true
  try {
    const result = await installPluginDependencies(pluginId.value, {
      dependencies: installDependencies.value,
      mode: installMode.value,
    })
    dependencies.value = result.dependencies
    resourceStore.invalidate('pluginDefinitions')
    installVisible.value = false
    if (installSource.value === 'coordinates') dependencyText.value = ''
    else selectedLocalCoordinates.value = new Set()
    ElMessage.success('定义依赖已更新；相关运行实例需按后端策略重启')
  } finally {
    installing.value = false
  }
}

async function reinstall() {
  await useConfirmAction({
    title: '按插件声明重装依赖',
    message: '将重新读取插件包中的依赖声明并覆盖当前定义依赖，是否继续？',
    successMessage: '依赖已重装',
    action: async () => {
      const result = await reinstallPluginDependencies(pluginId.value)
      dependencies.value = result.dependencies
      resourceStore.invalidate('pluginDefinitions')
    },
  })
}

async function removeDependency(row: PluginDependency) {
  await useConfirmAction({
    title: '移除定义依赖',
    message: `确认移除依赖 ${coordinate(row)}？`,
    successMessage: '依赖已移除',
    action: async () => {
      const result = await uninstallPluginDependencies(pluginId.value, {
        dependencies: [coordinate(row)],
      })
      dependencies.value = result.dependencies
      resourceStore.invalidate('pluginDefinitions')
    },
  })
}

async function removeDefinition() {
  await ElMessageBox.confirm(
    '存在安装实例时后端会拒绝删除。确认删除该全局插件包？',
    '删除插件定义',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    },
  )
  await deletePluginDefinition(pluginId.value)
  resourceStore.invalidate('pluginDefinitions')
  ElMessage.success('插件定义已删除')
  router.replace('/plugins/definitions')
}

function createInstallation() {
  router.push({ path: '/plugins/installations', query: { create: '1', pluginId: pluginId.value } })
}

onMounted(load)
</script>

<template>
  <PageContainer
    :title="definition?.displayName || pluginId"
    description="全局插件包详情及定义级依赖，不代表任何具体运行实例。"
  >
    <template #extra>
      <PageBackButton fallback="/plugins/definitions" />
      <PermissionGuard permission="plugin:runtime:manage">
        <el-button type="success" @click="createInstallation">创建隔离实例</el-button>
        <el-button type="danger" plain @click="removeDefinition">删除定义</el-button>
      </PermissionGuard>
    </template>

    <el-skeleton v-if="loading" animated :rows="7" />
    <template v-else-if="definition">
      <el-descriptions title="全局定义" :column="2" border>
        <el-descriptions-item label="Plugin ID">{{ definition.pluginId }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ definition.version }}</el-descriptions-item>
        <el-descriptions-item label="主类" :span="2">{{
          definition.mainClass
        }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256" :span="2">{{
          definition.artifactSha256
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatDateTime(definition.createdAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{
          formatDateTime(definition.updatedAt)
        }}</el-descriptions-item>
      </el-descriptions>

      <el-card shadow="never" style="margin-top: 16px">
        <template #header>
          <div class="dependency-header">
            <strong>定义依赖</strong>
            <PermissionGuard permission="plugin:runtime:manage">
              <el-button type="primary" @click="openInstallDialog">安装依赖</el-button>
              <el-button type="warning" plain @click="reinstall">按声明重装</el-button>
            </PermissionGuard>
          </div>
        </template>
        <el-table v-loading="dependencyLoading" :data="dependencies" border>
          <el-table-column label="Maven 坐标" min-width="260"
            ><template #default="{ row }">{{ coordinate(row) }}</template></el-table-column
          >
          <el-table-column prop="extension" label="类型" width="100" />
          <el-table-column
            prop="relativePath"
            label="仓库路径"
            min-width="260"
            show-overflow-tooltip
          />
          <el-table-column prop="sha256" label="SHA-256" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="90">
            <template #default="{ row }"
              ><PermissionGuard permission="plugin:runtime:manage"
                ><el-button link type="danger" @click="removeDependency(row)"
                  >移除</el-button
                ></PermissionGuard
              ></template
            >
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <el-dialog v-model="installVisible" title="安装定义依赖" width="980px">
      <el-tabs v-model="installSource" @tab-change="handleInstallSourceChange">
        <el-tab-pane label="Maven 坐标" name="coordinates">
          <el-input
            v-model="dependencyText"
            type="textarea"
            :rows="8"
            placeholder="每行一个 groupId:artifactId:version"
          />
        </el-tab-pane>

        <el-tab-pane label="本地依赖制品" name="local">
          <div class="local-artifact-toolbar">
            <el-input
              v-model="localArtifactTable.query.keyword"
              clearable
              placeholder="搜索坐标或原始文件名"
              @keyup.enter="searchLocalArtifacts"
              @clear="searchLocalArtifacts"
            />
            <el-button type="primary" plain @click="searchLocalArtifacts">查询</el-button>
            <el-button type="success" @click="openLocalUpload">上传本地依赖</el-button>
            <span class="local-artifact-selection">
              已选 {{ selectedLocalCoordinates.size }} 项
            </span>
          </div>

          <PaginationTable
            :data="localArtifactTable.items.value"
            :loading="localArtifactTable.loading.value"
            :total="localArtifactTable.total.value"
            :page="localArtifactTable.page.value"
            :size="localArtifactTable.size.value"
            border
            max-height="360"
            @page-change="localArtifactTable.changePage"
            @size-change="localArtifactTable.changeSize"
          >
            <el-table-column width="52" fixed="left">
              <template #default="{ row }">
                <el-checkbox
                  :model-value="selectedLocalCoordinates.has(row.coordinate)"
                  :aria-label="`选择依赖 ${row.coordinate}`"
                  @change="toggleLocalArtifact(row.coordinate, Boolean($event))"
                />
              </template>
            </el-table-column>
            <el-table-column prop="coordinate" label="Maven 坐标" min-width="250" />
            <el-table-column
              prop="originalFilename"
              label="原始文件名"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column label="大小" width="100">
              <template #default="{ row }">{{ formatFileSize(row.sizeBytes) }}</template>
            </el-table-column>
            <el-table-column prop="sha256" label="SHA-256" min-width="210" show-overflow-tooltip />
            <el-table-column label="上传时间" min-width="175">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
          </PaginationTable>
        </el-tab-pane>
      </el-tabs>

      <div class="install-mode-row">
        <span>安装方式</span>
        <el-radio-group v-model="installMode">
          <el-radio-button value="merge">合并</el-radio-button>
          <el-radio-button value="replace">覆盖</el-radio-button>
        </el-radio-group>
        <span class="install-mode-hint">
          {{ installMode === 'merge' ? '保留现有依赖并追加所选项' : '以所选项替换现有依赖' }}
        </span>
      </div>
      <template #footer>
        <el-button @click="installVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="installing"
          :disabled="!installDependencies.length"
          @click="install"
          >安装</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="localUploadVisible"
      title="上传本地依赖制品"
      width="620px"
      append-to-body
      @closed="resetLocalUpload"
    >
      <el-alert
        title="上传会保存到本地依赖仓库；可仅上传后批量选择，也可立即安装到当前插件定义。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-form
        ref="localUploadFormRef"
        :model="localUploadForm"
        :rules="localUploadRules"
        label-width="110px"
      >
        <el-form-item label="Group ID" prop="groupId">
          <el-input v-model="localUploadForm.groupId" placeholder="例如 com.example" />
        </el-form-item>
        <el-form-item label="Artifact ID" prop="artifactId">
          <el-input v-model="localUploadForm.artifactId" placeholder="例如 local-sdk" />
        </el-form-item>
        <el-form-item label="版本" prop="version">
          <el-input v-model="localUploadForm.version" placeholder="例如 1.0.0" />
        </el-form-item>
        <el-form-item label="依赖文件" required>
          <el-upload
            ref="localUploadRef"
            class="local-dependency-upload"
            :auto-upload="false"
            :limit="1"
            accept=".jar"
            :disabled="localUploading"
            :on-change="handleLocalFileChange"
            :on-remove="handleLocalFileRemove"
          >
            <el-button type="primary" plain>选择 JAR 文件</el-button>
            <template #tip>
              <div class="el-upload__tip">一次上传一个本地 JAR 依赖。</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="localUploading" @click="localUploadVisible = false">取消</el-button>
        <el-button :loading="localUploading" @click="uploadLocalArtifact(false)">仅上传</el-button>
        <el-button type="primary" :loading="localUploading" @click="uploadLocalArtifact(true)">
          上传并安装
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.dependency-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.local-artifact-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.local-artifact-selection,
.install-mode-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.install-mode-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}

.local-dependency-upload {
  width: 100%;
}

@media (max-width: 760px) {
  .local-artifact-toolbar {
    grid-template-columns: 1fr auto;
  }

  .local-artifact-toolbar .el-input {
    grid-column: 1 / -1;
  }

  .install-mode-row {
    flex-wrap: wrap;
  }
}
</style>
