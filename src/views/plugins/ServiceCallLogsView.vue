<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  getPluginServiceCall,
  getPluginServiceCallRunnerLog,
  listPluginServiceCalls,
} from '@/api/plugins'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginDefinitionSelect from '@/components/plugins/PluginDefinitionSelect.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type {
  PluginServiceCallLog,
  PluginServiceCallQuery,
  PluginServiceCallRunnerLog,
} from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const canReadInstallations = computed(() => userStore.permissions.includes('plugin:runtime:read'))
const table = usePagination<PluginServiceCallLog, Omit<PluginServiceCallQuery, 'page' | 'size'>>(
  {
    jobId: '',
    callerInstallationId: '',
    callerPluginId: '',
    targetInstallationId: '',
    targetPluginId: '',
    operation: '',
    success: '',
  },
  (params) => listPluginServiceCalls(params),
)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<PluginServiceCallLog>()
const logVisible = ref(false)
const logLoading = ref(false)
const logTarget = ref<PluginServiceCallLog>()
const runnerLog = ref<PluginServiceCallRunnerLog>()
const runnerLogContent = ref('')

function successTagType(success: boolean) {
  return success ? 'success' : 'danger'
}

function formatMillis(value?: number | null) {
  return typeof value === 'number' ? `${value}ms` : '-'
}

function formatBytes(value?: number | null) {
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function fallback(value?: string | number | null) {
  return value || '-'
}

function serviceCallError(row: PluginServiceCallLog) {
  if (row.errorMessage) return row.errorMessage
  if (row.errorType) return row.errorType
  return '-'
}

function resetFilters() {
  void table.reset()
}

function normalizeQuery() {
  table.query.jobId = String(table.query.jobId || '').trim()
}

async function search() {
  normalizeQuery()
  await table.load()
}

async function openDetail(row: PluginServiceCallLog) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = undefined
  try {
    detail.value = await getPluginServiceCall(row.id)
  } finally {
    detailLoading.value = false
  }
}

async function openRunnerLog(row: PluginServiceCallLog) {
  logVisible.value = true
  logLoading.value = true
  logTarget.value = row
  runnerLog.value = undefined
  runnerLogContent.value = ''
  try {
    const log = await getPluginServiceCallRunnerLog(row.id, { tailBytes: 64 * 1024 })
    runnerLog.value = log
    runnerLogContent.value = log.content
  } finally {
    logLoading.value = false
  }
}

function initQueryFromRoute() {
  const { jobId, callerInstallationId, callerPluginId, targetInstallationId, targetPluginId } =
    route.query
  if (typeof jobId === 'string' && jobId) table.query.jobId = jobId
  if (typeof callerInstallationId === 'string') {
    table.query.callerInstallationId = callerInstallationId
  }
  if (typeof callerPluginId === 'string') table.query.callerPluginId = callerPluginId
  if (typeof targetInstallationId === 'string') {
    table.query.targetInstallationId = targetInstallationId
  }
  if (typeof targetPluginId === 'string') table.query.targetPluginId = targetPluginId
}

onMounted(() => {
  initQueryFromRoute()
  void table.load()
})
watch(
  () => resourceStore.revisions.pluginService,
  () => {
    if (!table.loading.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="插件服务调用日志"
    description="追踪插件间服务调用、耗时、失败原因和目标服务插件 runner 日志。"
  >
    <el-card class="service-call-filter-card" shadow="never">
      <el-form class="search-form" inline :model="table.query">
        <el-form-item label="任务 ID">
          <el-input v-model="table.query.jobId" clearable placeholder="输入任务 ID" />
        </el-form-item>
        <el-form-item label="调用方实例">
          <PluginInstallationSelect
            v-if="canReadInstallations"
            v-model="table.query.callerInstallationId"
            usage="RUNTIME"
            placeholder="调用方 installationId"
            width="260px"
          />
          <el-input
            v-else
            v-model="table.query.callerInstallationId"
            clearable
            placeholder="输入调用方 installationId"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="调用方定义">
          <div class="definition-filter">
            <PluginDefinitionSelect
              v-if="canReadInstallations"
              v-model="table.query.callerPluginId"
              placeholder="调用方 pluginId"
            />
            <el-input
              v-else
              v-model="table.query.callerPluginId"
              clearable
              placeholder="输入调用方 pluginId"
            />
          </div>
        </el-form-item>
        <el-form-item label="目标方实例">
          <PluginInstallationSelect
            v-if="canReadInstallations"
            v-model="table.query.targetInstallationId"
            usage="SERVICE"
            placeholder="目标方 installationId"
            width="260px"
          />
          <el-input
            v-else
            v-model="table.query.targetInstallationId"
            clearable
            placeholder="输入目标方 installationId"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="目标方定义">
          <div class="definition-filter">
            <PluginDefinitionSelect
              v-if="canReadInstallations"
              v-model="table.query.targetPluginId"
              placeholder="目标方 pluginId"
            />
            <el-input
              v-else
              v-model="table.query.targetPluginId"
              clearable
              placeholder="输入目标方 pluginId"
            />
          </div>
        </el-form-item>
        <el-form-item label="操作名">
          <el-input v-model="table.query.operation" clearable placeholder="例如 login" />
        </el-form-item>
        <el-form-item label="是否成功">
          <el-select
            v-model="table.query.success"
            clearable
            placeholder="全部"
            style="width: 120px"
          >
            <el-option label="成功" :value="true" />
            <el-option label="失败" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <PaginationTable
      :data="table.items.value"
      :loading="table.loading.value"
      :total="table.total.value"
      :page="table.page.value"
      :size="table.size.value"
      empty-text="暂无插件服务调用日志"
      @page-change="table.changePage"
      @size-change="table.changeSize"
    >
      <el-table-column label="时间" min-width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="jobId" label="任务 ID" width="100">
        <template #default="{ row }">{{ fallback(row.jobId) }}</template>
      </el-table-column>
      <el-table-column
        prop="callerInstallationId"
        label="调用方 Installation ID"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column
        prop="callerPluginId"
        label="调用方插件"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="调用方归属" min-width="170">
        <template #default="{ row }">
          <OwnerSummary
            :owner-user-id="row.callerOwnerUserId"
            :owner-department-id="row.callerOwnerDepartmentId"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="targetInstallationId"
        label="目标方 Installation ID"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column
        prop="targetPluginId"
        label="目标服务插件"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column label="目标方归属" min-width="170">
        <template #default="{ row }">
          <OwnerSummary
            :owner-user-id="row.targetOwnerUserId"
            :owner-department-id="row.targetOwnerDepartmentId"
          />
        </template>
      </el-table-column>
      <el-table-column prop="operation" label="操作" min-width="130" show-overflow-tooltip />
      <el-table-column label="成功" width="90">
        <template #default="{ row }">
          <el-tag :type="successTagType(row.success)">{{ row.success ? '成功' : '失败' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="100">
        <template #default="{ row }">{{ formatMillis(row.durationMillis) }}</template>
      </el-table-column>
      <el-table-column label="错误信息" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">{{ serviceCallError(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link type="primary" @click="openRunnerLog(row)">查看日志</el-button>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="detailVisible" title="服务调用详情" width="860px" destroy-on-close>
      <el-skeleton v-if="detailLoading" animated :rows="10" />
      <el-descriptions v-else-if="detail" :column="2" border>
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="任务 ID">{{ fallback(detail.jobId) }}</el-descriptions-item>
        <el-descriptions-item label="执行 ID">{{
          fallback(detail.executionId)
        }}</el-descriptions-item>
        <el-descriptions-item label="操作">{{ detail.operation }}</el-descriptions-item>
        <el-descriptions-item label="调用方 Installation ID" :span="2">{{
          detail.callerInstallationId
        }}</el-descriptions-item>
        <el-descriptions-item label="调用方插件">{{ detail.callerPluginId }}</el-descriptions-item>
        <el-descriptions-item label="调用方归属">
          <OwnerSummary
            :owner-user-id="detail.callerOwnerUserId"
            :owner-department-id="detail.callerOwnerDepartmentId"
            compact
          />
        </el-descriptions-item>
        <el-descriptions-item label="目标方 Installation ID" :span="2">{{
          detail.targetInstallationId
        }}</el-descriptions-item>
        <el-descriptions-item label="目标服务插件">{{
          detail.targetPluginId
        }}</el-descriptions-item>
        <el-descriptions-item label="目标方归属">
          <OwnerSummary
            :owner-user-id="detail.targetOwnerUserId"
            :owner-department-id="detail.targetOwnerDepartmentId"
            compact
          />
        </el-descriptions-item>
        <el-descriptions-item label="成功">
          <el-tag :type="successTagType(detail.success)">{{
            detail.success ? '成功' : '失败'
          }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调用方 Instance" :span="2">
          {{ fallback(detail.callerInstanceId) }}
        </el-descriptions-item>
        <el-descriptions-item label="服务 Instance" :span="2">
          {{ fallback(detail.targetInstanceId) }}
        </el-descriptions-item>
        <el-descriptions-item label="调用方 Request ID" :span="2">
          {{ fallback(detail.callerRequestId) }}
        </el-descriptions-item>
        <el-descriptions-item label="服务 Request ID" :span="2">
          {{ fallback(detail.serviceRequestId) }}
        </el-descriptions-item>
        <el-descriptions-item label="超时">{{
          formatMillis(detail.timeoutMillis)
        }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{
          formatMillis(detail.durationMillis)
        }}</el-descriptions-item>
        <el-descriptions-item label="请求大小">{{
          formatBytes(detail.requestBytes)
        }}</el-descriptions-item>
        <el-descriptions-item label="响应大小">{{
          formatBytes(detail.responseBytes)
        }}</el-descriptions-item>
        <el-descriptions-item label="错误类型" :span="2">{{
          fallback(detail.errorType)
        }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">
          {{ fallback(detail.errorMessage) }}
        </el-descriptions-item>
        <el-descriptions-item label="Runner Log Path" :span="2">
          {{ fallback(detail.targetRunnerLogPath) }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">
          {{ formatDateTime(detail.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="logVisible" title="服务插件日志" width="86%" destroy-on-close>
      <div class="log-meta">
        <el-tag size="small" :type="runnerLog?.exists === false ? 'danger' : 'info'">
          {{ runnerLog?.exists === false ? '日志不存在' : '服务插件日志' }}
        </el-tag>
        <el-tag v-if="runnerLog" size="small" :type="runnerLog.eof ? 'success' : 'warning'">
          {{ runnerLog.eof ? '已到末尾' : '未到末尾' }}
        </el-tag>
        <el-tag v-if="runnerLog?.truncated" size="small" type="warning">尾部截断</el-tag>
        <span
          >目标实例：{{
            runnerLog?.targetInstallationId || logTarget?.targetInstallationId || '-'
          }}</span
        >
        <span>操作：{{ logTarget?.operation || '-' }}</span>
      </div>
      <div class="log-meta">
        <span>路径：{{ runnerLog?.runnerLogPath || logTarget?.targetRunnerLogPath || '-' }}</span>
        <span>offset：{{ runnerLog?.offset ?? '-' }}</span>
        <span>nextOffset：{{ runnerLog?.nextOffset ?? '-' }}</span>
        <span>limitBytes：{{ runnerLog?.limitBytes ?? '-' }}</span>
        <span>大小：{{ formatBytes(runnerLog?.sizeBytes) }}</span>
      </div>
      <el-skeleton v-if="logLoading" animated :rows="6" />
      <el-empty
        v-else-if="runnerLog?.exists === false"
        description="服务插件日志文件不存在或尚未生成"
      />
      <div v-else v-loading="logLoading" class="terminal-panel">
        <pre>{{ runnerLogContent || '暂无日志内容' }}</pre>
      </div>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.service-call-filter-card {
  margin-bottom: 16px;
  border-color: var(--el-border-color-lighter);
}

.definition-filter {
  width: 230px;
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 12px;
}

.terminal-panel {
  position: relative;
  min-height: 360px;
  max-height: 56vh;
  overflow: auto;
  border: 1px solid #1e293b;
  border-radius: 14px;
  background:
    radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.12), transparent 28%),
    linear-gradient(180deg, #0f172a 0%, #020617 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.terminal-panel pre {
  min-height: 360px;
  margin: 0;
  padding: 18px 20px;
  color: #d1fae5;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
