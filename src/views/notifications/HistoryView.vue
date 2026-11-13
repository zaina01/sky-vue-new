<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getHistory, listHistory, retryHistory } from '@/api/notifications'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginDefinitionSelect from '@/components/plugins/PluginDefinitionSelect.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type {
  NotificationChannelType,
  NotificationHistoryItem,
  NotificationHistoryQuery,
  NotificationSendStatus,
  NotificationSourceType,
} from '@/types/notifications'
import { formatDateTime } from '@/utils/format'

const statusOptions: NotificationSendStatus[] = [
  'PENDING',
  'SENDING',
  'RETRY_WAITING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
]
const sourceTypeOptions: NotificationSourceType[] = ['HOST_ALERT', 'PLUGIN_RUNTIME', 'ADMIN_TEST']
const channelTypeOptions: NotificationChannelType[] = ['WEBHOOK', 'PUSHPLUS']

const route = useRoute()
const resourceStore = useResourceStore()
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<NotificationHistoryItem>()
let detailSequence = 0
const table = usePagination<
  NotificationHistoryItem,
  Omit<NotificationHistoryQuery, 'page' | 'size'>
>(
  {
    sourceType: '',
    channelId: '',
    channelType: '',
    status: '',
    installationId: '',
    pluginId: '',
    jobId: '',
    executionId: '',
    startTime: '',
    endTime: '',
  },
  (params) => listHistory(params),
)

function statusType(status: NotificationSendStatus) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RETRY_WAITING' || status === 'PENDING' || status === 'SENDING') return 'warning'
  return 'info'
}

function search() {
  table.page.value = 1
  return table.load()
}

function contentPreview(row: NotificationHistoryItem) {
  return row.contentPreview || '-'
}

async function showDetail(row: NotificationHistoryItem) {
  const sequence = ++detailSequence
  detailVisible.value = true
  detail.value = undefined
  detailLoading.value = true
  try {
    const response = await getHistory(row.id)
    if (sequence === detailSequence) detail.value = response
  } finally {
    if (sequence === detailSequence) detailLoading.value = false
  }
}

async function retry(row: NotificationHistoryItem) {
  await useConfirmAction({
    title: '重试通知',
    message: `确认请求后端重试通知记录「${row.id}」？是否允许重试及渠道是否仍可访问均以后端判定为准。`,
    successMessage: '重试请求已提交',
    action: () => retryHistory(row.id),
  })
  resourceStore.invalidate('notificationHistory')
  await table.load()
}

function initQueryFromRoute() {
  const keys: Array<keyof NotificationHistoryQuery> = [
    'installationId',
    'pluginId',
    'jobId',
    'executionId',
    'channelId',
  ]
  for (const key of keys) {
    const value = route.query[key]
    if (typeof value === 'string') {
      ;(table.query as Record<string, unknown>)[key] = value
    }
  }
}

onMounted(() => {
  initQueryFromRoute()
  table.load()
})
watch(
  () => resourceStore.revisions.notificationHistory,
  () => {
    if (!table.loading.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="通知发送历史"
    description="历史由后端按来源方或渠道方任一匹配数据范围返回；前端不做二次归属过滤。"
  >
    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="状态">
        <el-select
          v-model="table.query.status"
          clearable
          placeholder="全部状态"
          style="width: 170px"
        >
          <el-option
            v-for="status in statusOptions"
            :key="status"
            :label="status"
            :value="status"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="来源">
        <el-select
          v-model="table.query.sourceType"
          clearable
          placeholder="全部来源"
          style="width: 180px"
        >
          <el-option
            v-for="sourceType in sourceTypeOptions"
            :key="sourceType"
            :label="sourceType"
            :value="sourceType"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="渠道类型">
        <el-select
          v-model="table.query.channelType"
          clearable
          placeholder="全部类型"
          style="width: 150px"
        >
          <el-option
            v-for="channelType in channelTypeOptions"
            :key="channelType"
            :label="channelType"
            :value="channelType"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Channel ID"
        ><el-input v-model="table.query.channelId" clearable style="width: 160px"
      /></el-form-item>
      <el-form-item label="安装实例">
        <PluginInstallationSelect
          v-model="table.query.installationId"
          usage="NOTIFICATION"
          placeholder="installationId"
          width="270px"
        />
      </el-form-item>
      <el-form-item label="插件定义">
        <div class="definition-filter">
          <PluginDefinitionSelect v-model="table.query.pluginId" placeholder="pluginId" />
        </div>
      </el-form-item>
      <el-form-item label="Job ID"
        ><el-input v-model="table.query.jobId" clearable style="width: 130px"
      /></el-form-item>
      <el-form-item label="Execution ID"
        ><el-input v-model="table.query.executionId" clearable style="width: 150px"
      /></el-form-item>
      <el-form-item label="开始时间">
        <el-date-picker
          v-model="table.query.startTime"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          placeholder="开始时间"
          style="width: 190px"
        />
      </el-form-item>
      <el-form-item label="结束时间">
        <el-date-picker
          v-model="table.query.endTime"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          placeholder="结束时间"
          style="width: 190px"
        />
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
      <el-table-column prop="sourceType" label="来源" min-width="150" />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="130">
        <template #default="{ row }">{{ row.pluginId || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }"
          ><el-tag :type="statusType(row.status)">{{ row.status }}</el-tag></template
        >
      </el-table-column>
      <el-table-column label="内容摘要" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">{{ contentPreview(row) }}</template>
      </el-table-column>
      <el-table-column label="时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="尝试次数" width="100">
        <template #default="{ row }"
          >{{ row.attemptCount ?? 0 }} / {{ row.maxAttempts ?? '-' }}</template
        >
      </el-table-column>
      <el-table-column prop="channelId" label="Channel ID" min-width="100" />
      <el-table-column prop="channelType" label="渠道类型" width="110" />
      <el-table-column
        prop="installationId"
        label="Installation ID"
        min-width="250"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ row.installationId || '-' }}</template>
      </el-table-column>
      <el-table-column label="来源归属快照" min-width="180">
        <template #default="{ row }">
          <OwnerSummary
            :owner-user-id="row.sourceOwnerUserId"
            :owner-department-id="row.sourceOwnerDepartmentId"
          />
        </template>
      </el-table-column>
      <el-table-column label="渠道归属快照" min-width="180">
        <template #default="{ row }">
          <OwnerSummary
            :owner-user-id="row.channelOwnerUserId"
            :owner-department-id="row.channelOwnerDepartmentId"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">详情</el-button>
          <PermissionGuard permission="notification:history:retry">
            <el-button link type="danger" @click="retry(row)">重试</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="detailVisible" title="通知详情" width="900px" destroy-on-close>
      <el-skeleton v-if="detailLoading" animated :rows="12" />
      <el-descriptions v-else-if="detail" :column="2" border>
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="Request ID">{{
          detail.requestId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ detail.sourceType }}</el-descriptions-item>
        <el-descriptions-item label="状态"
          ><el-tag :type="statusType(detail.status)">{{
            detail.status
          }}</el-tag></el-descriptions-item
        >
        <el-descriptions-item label="Installation ID" :span="2">{{
          detail.installationId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="Plugin ID">{{ detail.pluginId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Instance ID">{{
          detail.instanceId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="来源归属快照">
          <OwnerSummary
            :owner-user-id="detail.sourceOwnerUserId"
            :owner-department-id="detail.sourceOwnerDepartmentId"
            compact
          />
        </el-descriptions-item>
        <el-descriptions-item label="渠道归属快照">
          <OwnerSummary
            :owner-user-id="detail.channelOwnerUserId"
            :owner-department-id="detail.channelOwnerDepartmentId"
            compact
          />
        </el-descriptions-item>
        <el-descriptions-item label="Job ID">{{ detail.jobId ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="Execution ID">{{
          detail.executionId ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="Channel ID">{{ detail.channelId }}</el-descriptions-item>
        <el-descriptions-item label="渠道类型">{{ detail.channelType }}</el-descriptions-item>
        <el-descriptions-item label="标题" :span="2">{{
          detail.title || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="内容摘要" :span="2">{{
          contentPreview(detail)
        }}</el-descriptions-item>
        <el-descriptions-item label="Payload Bytes">{{
          detail.payloadBytes ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item label="尝试次数"
          >{{ detail.attemptCount ?? 0 }} / {{ detail.maxAttempts ?? '-' }}</el-descriptions-item
        >
        <el-descriptions-item label="下次重试">{{
          formatDateTime(detail.nextRetryAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="首次尝试">{{
          formatDateTime(detail.firstAttemptAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="最后尝试">{{
          formatDateTime(detail.lastAttemptAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="手动重试次数">{{
          detail.manualRetryCount ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item label="最后手动重试">{{
          formatDateTime(detail.lastManualRetryAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="最后手动重试人">{{
          detail.lastManualRetryBy || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="错误类型">{{ detail.errorType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Provider Code">{{
          detail.providerStatusCode ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="Provider Message" :span="2">{{
          detail.providerMessage || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="错误信息" :span="2">{{
          detail.errorMessage || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatDateTime(detail.createdAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="发送时间">{{
          formatDateTime(detail.sentAt)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.definition-filter {
  width: 220px;
}
</style>
