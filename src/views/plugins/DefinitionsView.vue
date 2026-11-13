<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { deletePluginDefinition, listPluginDefinitions, uploadPluginArtifact } from '@/api/plugins'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type {
  PluginDefinitionQuery,
  PluginDefinitionResponse,
  PluginUploadResult,
} from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const router = useRouter()
const resourceStore = useResourceStore()
const table = usePagination<PluginDefinitionResponse, Omit<PluginDefinitionQuery, 'page' | 'size'>>(
  { keyword: '' },
  (params) => listPluginDefinitions(params),
)
const uploadVisible = ref(false)
const uploading = ref(false)
const uploadResult = ref<PluginUploadResult>()
const uploadFileName = ref('')
const resultVisible = computed(() => Boolean(uploadResult.value))

function beforeUpload(file: File) {
  if (!file.name.endsWith('.jar') && !file.name.endsWith('.zip')) {
    ElMessage.error('仅支持上传 .jar 或 .zip 插件包')
    return false
  }
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.error('插件包大小不能超过 200MB')
    return false
  }
  return true
}

async function upload(options: { file: File }) {
  uploading.value = true
  uploadFileName.value = options.file.name
  uploadResult.value = undefined
  try {
    uploadResult.value = await uploadPluginArtifact(options.file)
    resourceStore.invalidate('pluginDefinitions')
    await table.load()
    ElMessage.success('插件包已写入全局目录；尚未创建运行实例')
  } finally {
    uploading.value = false
  }
}

function createInstallation(pluginId: string) {
  uploadVisible.value = false
  router.push({ path: '/plugins/installations', query: { create: '1', pluginId } })
}

async function remove(row: PluginDefinitionResponse) {
  await useConfirmAction({
    title: '删除全局插件包',
    message: `确认删除插件定义「${row.displayName || row.pluginId}」？存在安装实例时后端会拒绝。`,
    successMessage: '插件定义已删除',
    action: () => deletePluginDefinition(row.pluginId),
  })
  resourceStore.invalidate('pluginDefinitions')
  await table.load()
}

onMounted(table.load)
watch(
  () => resourceStore.revisions.pluginDefinitions,
  () => {
    if (!table.loading.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="插件目录"
    description="全局插件包：这里只维护插件定义，上传不会自动创建可运行实例。"
  >
    <template #extra>
      <PermissionGuard permission="plugin:artifact:upload">
        <el-button type="primary" @click="uploadVisible = true">上传插件包</el-button>
      </PermissionGuard>
    </template>

    <el-alert
      title="插件定义是全局控制面；配置、账户、运行状态和主动推送授权属于彼此隔离的安装实例。"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="关键词">
        <el-input v-model="table.query.keyword" clearable placeholder="插件 ID 或名称" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="table.load">查询</el-button>
        <el-button @click="table.reset">重置</el-button>
      </el-form-item>
    </el-form>

    <PaginationTable
      :data="table.items.value"
      :loading="table.loading.value"
      :total="table.total.value"
      :page="table.page.value"
      :size="table.size.value"
      @page-change="table.changePage"
      @size-change="table.changeSize"
    >
      <el-table-column prop="displayName" label="插件名称" min-width="170" />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="160" />
      <el-table-column prop="version" label="版本" width="120" />
      <el-table-column prop="mainClass" label="主类" min-width="240" show-overflow-tooltip />
      <el-table-column
        prop="artifactSha256"
        label="SHA-256"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <RouterLink
            :to="{ name: 'plugin-definition-detail', params: { pluginId: row.pluginId } }"
          >
            <el-button link type="primary">详情/依赖</el-button>
          </RouterLink>
          <PermissionGuard permission="plugin:runtime:manage">
            <el-button link type="success" @click="createInstallation(row.pluginId)"
              >创建实例</el-button
            >
            <el-button link type="danger" @click="remove(row)">删除定义</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="uploadVisible" title="上传全局插件包" width="680px" destroy-on-close>
      <el-alert
        title="上传只创建或更新全局插件定义，不会启动 runner，也不会复用现有实例配置。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-upload
        drag
        :http-request="upload"
        :before-upload="beforeUpload"
        :show-file-list="false"
        :disabled="uploading"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽插件包到此处，或 <em>点击上传</em></div>
      </el-upload>
      <el-alert
        v-if="uploading"
        :title="`正在上传 ${uploadFileName}，请等待服务端校验。`"
        type="info"
        :closable="false"
        style="margin-top: 16px"
      />
      <el-descriptions
        v-if="resultVisible && uploadResult"
        title="上传结果"
        :column="1"
        border
        style="margin-top: 16px"
      >
        <el-descriptions-item label="Plugin ID">{{ uploadResult.pluginId }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ uploadResult.version }}</el-descriptions-item>
        <el-descriptions-item label="主类">{{ uploadResult.mainClass }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256">{{
          uploadResult.artifactSha256
        }}</el-descriptions-item>
        <el-descriptions-item label="已解析依赖">{{
          uploadResult.resolvedDependencyCount
        }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="uploadVisible = false">关闭</el-button>
        <PermissionGuard permission="plugin:runtime:manage">
          <el-button
            v-if="uploadResult"
            type="primary"
            @click="createInstallation(uploadResult.pluginId)"
          >
            创建隔离实例
          </el-button>
        </PermissionGuard>
      </template>
    </el-dialog>
  </PageContainer>
</template>
