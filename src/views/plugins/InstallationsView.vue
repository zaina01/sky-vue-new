<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createPluginInstallation,
  deletePluginInstallation,
  listPluginInstallations,
  restartPluginInstallation,
  startPluginInstallation,
  stopPluginInstallation,
} from '@/api/plugins'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginDefinitionSelect from '@/components/plugins/PluginDefinitionSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type {
  CreatePluginInstallationRequest,
  PluginInstallationQuery,
  PluginInstallationResponse,
  PluginRuntimeState,
} from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const resourceStore = useResourceStore()
const states: Array<{ label: string; value: PluginRuntimeState }> = [
  { label: '已停止', value: 'STOPPED' },
  { label: '启动中', value: 'STARTING' },
  { label: '运行中', value: 'RUNNING' },
  { label: '异常', value: 'FAILED' },
]
const table = usePagination<
  PluginInstallationResponse,
  Omit<PluginInstallationQuery, 'page' | 'size'>
>({ pluginId: '', state: '' }, (params) => listPluginInstallations(params))
const operatingId = ref('')
const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive<CreatePluginInstallationRequest>({ pluginId: '', installationName: '' })
const createRules: FormRules<CreatePluginInstallationRequest> = {
  pluginId: [{ required: true, message: '请选择全局插件包', trigger: 'change' }],
  installationName: [{ required: true, message: '请输入安装实例名称', trigger: 'blur' }],
}

function effectiveState(row: PluginInstallationResponse) {
  return row.liveState || row.state
}

function stateLabel(state?: string) {
  return states.find((item) => item.value === state)?.label || state || '未知'
}

function stateType(state?: string) {
  if (state === 'RUNNING') return 'success'
  if (state === 'STARTING') return 'warning'
  if (state === 'FAILED') return 'danger'
  return 'info'
}

async function operate(row: PluginInstallationResponse, action: 'start' | 'stop' | 'restart') {
  const labels = { start: '启动', stop: '停止', restart: '重启' }
  const api = {
    start: startPluginInstallation,
    stop: stopPluginInstallation,
    restart: restartPluginInstallation,
  }[action]
  operatingId.value = row.installationId
  try {
    await useConfirmAction({
      title: `${labels[action]}安装实例`,
      message: `确认${labels[action]}「${row.installationName}」？`,
      successMessage: `${labels[action]}请求已提交`,
      action: () => api(row.installationId),
    })
    resourceStore.invalidate('pluginInstallations')
    await table.load()
  } finally {
    operatingId.value = ''
  }
}

async function remove(row: PluginInstallationResponse) {
  operatingId.value = row.installationId
  try {
    await useConfirmAction({
      title: '删除隔离实例',
      message: `确认删除「${row.installationName}」？只删除该安装实例，不删除全局插件包。`,
      successMessage: '安装实例已删除',
      action: () => deletePluginInstallation(row.installationId),
    })
    resourceStore.invalidate('pluginInstallations', 'pluginConfig', 'pluginAccounts')
    await table.load()
  } finally {
    operatingId.value = ''
  }
}

function openCreate(pluginId = '') {
  createForm.pluginId = pluginId
  createForm.installationName = ''
  createVisible.value = true
  createFormRef.value?.clearValidate()
}

async function createInstallation() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return
  creating.value = true
  try {
    const created = await createPluginInstallation({
      pluginId: createForm.pluginId,
      installationName: createForm.installationName.trim(),
    })
    ElMessage.success('隔离实例已创建')
    createVisible.value = false
    resourceStore.invalidate('pluginInstallations')
    await table.load()
    await router.push(`/plugins/installations/${created.installationId}/overview`)
  } finally {
    creating.value = false
  }
}

function search() {
  table.page.value = 1
  return table.load()
}

onMounted(async () => {
  const pluginId = typeof route.query.pluginId === 'string' ? route.query.pluginId : ''
  if (pluginId) table.query.pluginId = pluginId
  await table.load()
  if (route.query.create === '1') openCreate(pluginId)
})
watch(
  () => resourceStore.revisions.pluginInstallations,
  () => {
    if (!table.loading.value && !creating.value && !operatingId.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="插件安装实例"
    description="隔离实例：同一 Plugin ID 可拥有多个完全独立的配置、账户和运行状态。"
  >
    <template #extra>
      <PermissionGuard permission="plugin:runtime:manage">
        <el-button type="primary" @click="openCreate()">创建安装实例</el-button>
      </PermissionGuard>
    </template>

    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="全局插件包">
        <div style="width: 320px"><PluginDefinitionSelect v-model="table.query.pluginId" /></div>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="table.query.state" clearable placeholder="全部" style="width: 150px">
          <el-option
            v-for="item in states"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
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
      <el-table-column prop="installationName" label="安装名称" min-width="170" />
      <el-table-column prop="displayName" label="插件名称" min-width="150" />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="150" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }"
          ><el-tag :type="stateType(effectiveState(row))">{{
            stateLabel(effectiveState(row))
          }}</el-tag></template
        >
      </el-table-column>
      <el-table-column label="所有者/部门" min-width="130">
        <template #default="{ row }"><OwnerSummary v-bind="row" /></template>
      </el-table-column>
      <el-table-column
        prop="installationId"
        label="Installation ID"
        min-width="270"
        show-overflow-tooltip
      />
      <el-table-column label="更新时间" min-width="180"
        ><template #default="{ row }">{{
          formatDateTime(row.updatedAt)
        }}</template></el-table-column
      >
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="plugin:runtime:manage">
            <el-button
              v-if="effectiveState(row) !== 'RUNNING'"
              link
              type="success"
              :loading="operatingId === row.installationId"
              @click="operate(row, 'start')"
              >启动</el-button
            >
            <el-button
              v-if="effectiveState(row) === 'RUNNING'"
              link
              type="warning"
              :loading="operatingId === row.installationId"
              @click="operate(row, 'stop')"
              >停止</el-button
            >
            <el-button
              v-if="effectiveState(row) === 'RUNNING' || effectiveState(row) === 'FAILED'"
              link
              type="primary"
              :loading="operatingId === row.installationId"
              @click="operate(row, 'restart')"
              >重启</el-button
            >
          </PermissionGuard>
          <RouterLink :to="`/plugins/installations/${row.installationId}/overview`"
            ><el-button link type="primary">详情</el-button></RouterLink
          >
          <PermissionGuard permission="plugin:runtime:manage"
            ><el-button
              link
              type="danger"
              :loading="operatingId === row.installationId"
              @click="remove(row)"
              >删除</el-button
            ></PermissionGuard
          >
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="createVisible" title="创建插件安装实例" width="620px" destroy-on-close>
      <el-alert
        title="每个安装实例拥有独立配置、账户、运行状态和数据归属。"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="全局插件包" prop="pluginId"
          ><PluginDefinitionSelect v-model="createForm.pluginId" :clearable="false"
        /></el-form-item>
        <el-form-item label="实例名称" prop="installationName"
          ><el-input v-model="createForm.installationName" maxlength="100" show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createInstallation">创建</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>
