<script setup lang="ts">
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import VChart from 'vue-echarts'

import { getSystemOverview } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import { useResourceStore } from '@/stores/resource'
import type {
  SystemOverviewQuery,
  SystemOverviewResponse,
  SystemOverviewStatusCount,
  SystemOverviewTrendPoint,
} from '@/types/system'
import { formatDateTime, formatDuration } from '@/utils/format'

use([CanvasRenderer, BarChart, GridComponent, LegendComponent, TooltipComponent])

type StatusCount = SystemOverviewStatusCount<string>
type TrendPoint = SystemOverviewTrendPoint<string>

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

interface RequestError {
  code?: number
}

const loading = ref(false)
const resourceStore = useResourceStore()
const overview = ref<SystemOverviewResponse>()
const query = reactive<SystemOverviewQuery>({
  windowHours: 24,
  trendDays: 7,
  recentLimit: 5,
})

const windowHourOptions = [1, 6, 12, 24, 72, 168, 720]
const trendDayOptions = [7, 14, 30]
const recentLimitOptions = [5, 10, 20]

const executionStatusOrder = ['RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'SYSTEM_EXIT']
const notificationStatusOrder = [
  'PENDING',
  'SENDING',
  'RETRY_WAITING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
]

const overviewCards = computed(() => [
  {
    title: '已上传插件',
    value: overview.value?.uploadedPlugins ?? 0,
  },
  {
    title: '启用任务',
    value: overview.value?.enabledJobs ?? 0,
  },
  {
    title: '历史失败执行',
    value: overview.value?.failedExecutions ?? 0,
  },
  {
    title: '待重试通知',
    value: overview.value?.pendingRetryNotifications ?? 0,
  },
])

const runtimeDistributions = computed(() => [
  {
    title: '插件 runtime 状态',
    items: overview.value?.pluginRuntimeStates ?? [],
  },
  {
    title: '任务启停状态',
    items: overview.value?.jobStatuses ?? [],
  },
  {
    title: '任务执行中状态',
    items: overview.value?.jobExecutedStatuses ?? [],
  },
])

const windowDistributions = computed(() => [
  {
    title: '任务执行状态',
    items: overview.value?.executionStatusesInWindow ?? [],
  },
  {
    title: '通知发送状态',
    items: overview.value?.notificationStatusesInWindow ?? [],
  },
])

const executionTrendOption = computed(() =>
  buildTrendOption(overview.value?.trends.jobExecutions ?? [], executionStatusOrder),
)
const notificationTrendOption = computed(() =>
  buildTrendOption(overview.value?.trends.notifications ?? [], notificationStatusOrder),
)
const hasExecutionTrend = computed(() => hasTrendData(overview.value?.trends.jobExecutions ?? []))
const hasNotificationTrend = computed(() =>
  hasTrendData(overview.value?.trends.notifications ?? []),
)

function isRequestError(error: unknown): error is RequestError {
  return Boolean(error && typeof error === 'object' && 'code' in error)
}

function getStatusTagType(status: string): TagType {
  if (['SUCCESS', 'ENABLED', 'RUNNING'].includes(status)) return 'success'
  if (['FAILED', 'TIMEOUT', 'SYSTEM_EXIT'].includes(status)) return 'danger'
  if (['PENDING', 'SENDING', 'RETRY_WAITING', 'CANCELLED', 'STARTING'].includes(status)) {
    return 'warning'
  }
  if (['DISABLED', 'STOPPED', 'SKIPPED', 'IDLE'].includes(status)) return 'info'
  return 'primary'
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    STARTING: '启动中',
    RUNNING: '运行中',
    STOPPED: '已停止',
    FAILED: '失败',
    ENABLED: '已启用',
    DISABLED: '已禁用',
    IDLE: '空闲',
    SUCCESS: '成功',
    TIMEOUT: '超时',
    CANCELLED: '已取消',
    SYSTEM_EXIT: '系统退出',
    PENDING: '待发送',
    SENDING: '发送中',
    RETRY_WAITING: '等待重试',
    SKIPPED: '已跳过',
    HOST_ALERT: '主机告警',
    PLUGIN_RUNTIME: '插件运行器',
    ADMIN_TEST: '管理员测试',
    WEBHOOK: 'Webhook',
    PUSHPLUS: 'PushPlus',
  }
  return labels[status] ?? status
}

function getDistributionTotal(items: StatusCount[]) {
  return items.reduce((sum, item) => sum + item.count, 0)
}

function getDistributionPercent(item: StatusCount, items: StatusCount[]) {
  const total = getDistributionTotal(items)
  if (!total) return 0
  return Math.round((item.count / total) * 100)
}

function hasTrendData(points: TrendPoint[]) {
  return points.some((point) => point.count > 0)
}

function sortStatuses(statuses: string[], order: string[]) {
  return [...statuses].sort((left, right) => {
    const leftIndex = order.indexOf(left)
    const rightIndex = order.indexOf(right)
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
}

function buildTrendOption(points: TrendPoint[], statusOrder: string[]): EChartsOption {
  const dates = [...new Set(points.map((point) => point.date))].sort()
  const statuses = sortStatuses([...new Set(points.map((point) => point.status))], statusOrder)
  const valueMap = new Map(points.map((point) => [`${point.date}:${point.status}`, point.count]))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      top: 0,
      data: statuses.map(getStatusLabel),
    },
    grid: {
      left: 24,
      right: 16,
      top: 48,
      bottom: 24,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
    },
    series: statuses.map((status) => ({
      name: getStatusLabel(status),
      type: 'bar',
      stack: 'total',
      emphasis: {
        focus: 'series',
      },
      data: dates.map((date) => valueMap.get(`${date}:${status}`) ?? 0),
    })),
  }
}

function formatMaybeDateTime(value?: string | null) {
  return formatDateTime(value)
}

function formatMaybeDuration(value?: number | null) {
  return formatDuration(value ?? undefined)
}

async function loadOverview() {
  loading.value = true
  try {
    overview.value = await getSystemOverview({ ...query })
  } catch (error) {
    if (isRequestError(error) && error.code === 403001) {
      ElMessage.warning('缺少 system:overview:read 权限，无法查看项目运行概览')
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)
watch(
  () => [
    resourceStore.revisions.pluginInstallations,
    resourceStore.revisions.jobs,
    resourceStore.revisions.executions,
    resourceStore.revisions.notificationHistory,
  ],
  () => {
    if (!loading.value) void loadOverview()
  },
)
</script>

<template>
  <PageContainer title="项目运行概览" description="插件、任务执行和通知链路的集中态势视图。">
    <template #extra>
      <div class="overview-toolbar">
        <el-select
          v-model="query.windowHours"
          class="overview-toolbar__select"
          @change="loadOverview"
        >
          <el-option
            v-for="item in windowHourOptions"
            :key="item"
            :label="`${item} 小时窗口`"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.trendDays"
          class="overview-toolbar__select"
          @change="loadOverview"
        >
          <el-option
            v-for="item in trendDayOptions"
            :key="item"
            :label="`${item} 天趋势`"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="query.recentLimit"
          class="overview-toolbar__select"
          @change="loadOverview"
        >
          <el-option
            v-for="item in recentLimitOptions"
            :key="item"
            :label="`最近 ${item} 条`"
            :value="item"
          />
        </el-select>
        <el-button type="primary" :loading="loading" @click="loadOverview">刷新</el-button>
      </div>
    </template>

    <div v-loading="loading" class="overview-page">
      <el-row :gutter="16">
        <el-col v-for="card in overviewCards" :key="card.title" :span="6">
          <el-card shadow="never" class="ops-card overview-metric-card">
            <el-statistic :title="card.title" :value="card.value" />
          </el-card>
        </el-col>
      </el-row>

      <section class="overview-section">
        <div class="overview-section__header">
          <h3>当前运行态</h3>
        </div>
        <el-row :gutter="16">
          <el-col v-for="distribution in runtimeDistributions" :key="distribution.title" :span="8">
            <el-card shadow="never" class="overview-card">
              <template #header>{{ distribution.title }}</template>
              <div v-if="distribution.items.length" class="distribution-list">
                <div
                  v-for="item in distribution.items"
                  :key="item.status"
                  class="distribution-item"
                >
                  <div class="distribution-item__meta">
                    <el-tag :type="getStatusTagType(item.status)" size="small">
                      {{ getStatusLabel(item.status) }}
                    </el-tag>
                    <span>{{ item.count }}</span>
                  </div>
                  <el-progress
                    :percentage="getDistributionPercent(item, distribution.items)"
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
              </div>
              <el-empty v-else description="暂无状态数据" />
            </el-card>
          </el-col>
        </el-row>
      </section>

      <section class="overview-section">
        <div class="overview-section__header overview-section__header--split">
          <h3>窗口内执行概览</h3>
          <span v-if="overview?.window" class="overview-window-text">
            {{ formatMaybeDateTime(overview.window.startTime) }} 至
            {{ formatMaybeDateTime(overview.window.endTime) }}，{{ overview.window.windowHours }}
            小时窗口
          </span>
        </div>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-card shadow="never" class="overview-card overview-window-card">
              <template #header>统计窗口</template>
              <el-descriptions :column="1" border>
                <el-descriptions-item label="窗口小时">
                  {{ overview?.window.windowHours ?? query.windowHours }} 小时
                </el-descriptions-item>
                <el-descriptions-item label="趋势天数">
                  {{ overview?.window.trendDays ?? query.trendDays }} 天
                </el-descriptions-item>
                <el-descriptions-item label="最近失败">
                  {{ overview?.window.recentLimit ?? query.recentLimit }} 条
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
          <el-col v-for="distribution in windowDistributions" :key="distribution.title" :span="8">
            <el-card shadow="never" class="overview-card">
              <template #header>{{ distribution.title }}</template>
              <div v-if="distribution.items.length" class="distribution-list">
                <div
                  v-for="item in distribution.items"
                  :key="item.status"
                  class="distribution-item"
                >
                  <div class="distribution-item__meta">
                    <el-tag :type="getStatusTagType(item.status)" size="small">
                      {{ getStatusLabel(item.status) }}
                    </el-tag>
                    <span>{{ item.count }}</span>
                  </div>
                  <el-progress
                    :percentage="getDistributionPercent(item, distribution.items)"
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
              </div>
              <el-empty v-else description="暂无状态数据" />
            </el-card>
          </el-col>
        </el-row>
      </section>

      <section class="overview-section">
        <div class="overview-section__header">
          <h3>趋势图</h3>
        </div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card shadow="never" class="overview-card">
              <template #header>任务执行趋势</template>
              <VChart
                v-if="hasExecutionTrend"
                class="overview-chart"
                :option="executionTrendOption"
                autoresize
              />
              <el-empty v-else description="暂无任务执行趋势数据" />
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never" class="overview-card">
              <template #header>通知发送趋势</template>
              <VChart
                v-if="hasNotificationTrend"
                class="overview-chart"
                :option="notificationTrendOption"
                autoresize
              />
              <el-empty v-else description="暂无通知发送趋势数据" />
            </el-card>
          </el-col>
        </el-row>
      </section>

      <section class="overview-section">
        <div class="overview-section__header">
          <h3>最近失败</h3>
        </div>
        <el-card shadow="never" class="overview-card overview-table-card">
          <template #header>最近失败任务执行</template>
          <el-table
            :data="overview?.recentFailures.jobExecutions ?? []"
            empty-text="暂无失败任务执行"
            stripe
          >
            <el-table-column label="执行 ID" width="100">
              <template #default="{ row }">
                <RouterLink :to="`/jobs/executions/${row.id}`">{{ row.id }}</RouterLink>
              </template>
            </el-table-column>
            <el-table-column prop="jobName" label="任务" min-width="150" show-overflow-tooltip />
            <el-table-column prop="pluginId" label="插件" min-width="140" show-overflow-tooltip />
            <el-table-column prop="instanceId" label="实例" min-width="160" show-overflow-tooltip />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="errorType"
              label="错误类型"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column label="开始时间" min-width="170">
              <template #default="{ row }">{{ formatMaybeDateTime(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column label="结束时间" min-width="170">
              <template #default="{ row }">{{ formatMaybeDateTime(row.finishedAt) }}</template>
            </el-table-column>
            <el-table-column label="耗时" width="100">
              <template #default="{ row }">{{ formatMaybeDuration(row.durationMillis) }}</template>
            </el-table-column>
            <el-table-column
              prop="runnerLogPath"
              label="日志路径"
              min-width="220"
              show-overflow-tooltip
            />
          </el-table>
        </el-card>

        <el-card shadow="never" class="overview-card overview-table-card">
          <template #header>最近失败通知</template>
          <el-table
            :data="overview?.recentFailures.notifications ?? []"
            empty-text="暂无失败通知"
            stripe
          >
            <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
            <el-table-column label="来源" width="120">
              <template #default="{ row }">{{ getStatusLabel(row.sourceType) }}</template>
            </el-table-column>
            <el-table-column label="渠道" width="120">
              <template #default="{ row }">{{ getStatusLabel(row.channelType) }}</template>
            </el-table-column>
            <el-table-column prop="pluginId" label="插件" min-width="140" show-overflow-tooltip />
            <el-table-column prop="instanceId" label="实例" min-width="160" show-overflow-tooltip />
            <el-table-column prop="jobId" label="任务 ID" width="110" />
            <el-table-column label="执行 ID" width="110">
              <template #default="{ row }">
                <RouterLink v-if="row.executionId" :to="`/jobs/executions/${row.executionId}`">
                  {{ row.executionId }}
                </RouterLink>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="channelId"
              label="渠道 ID"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="errorType"
              label="错误类型"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatMaybeDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="发送时间" min-width="170">
              <template #default="{ row }">{{ formatMaybeDateTime(row.sentAt) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.overview-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.overview-toolbar__select {
  width: 140px;
}

.overview-page {
  min-height: 360px;
}

.overview-metric-card {
  margin-bottom: 0;
}

.overview-section {
  margin-top: 20px;
}

.overview-section__header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.overview-section__header--split {
  justify-content: space-between;
}

.overview-section__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2f3d;
}

.overview-window-text {
  color: #606266;
  font-size: 13px;
}

.overview-card {
  height: 100%;
}

.overview-window-card :deep(.el-descriptions__cell) {
  padding: 10px 12px;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.distribution-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #303133;
}

.overview-chart {
  width: 100%;
  height: 320px;
}

.overview-table-card + .overview-table-card {
  margin-top: 16px;
}
</style>
