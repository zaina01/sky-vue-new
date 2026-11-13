<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'

import { getExecution, getExecutionLogs } from '@/api/jobs'
import { getPluginServiceCallRunnerLog, listPluginServiceCalls } from '@/api/plugins'
import { listDepartments } from '@/api/system'
import PageBackButton from '@/components/PageBackButton/PageBackButton.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { ExecutionLogChunk, JobExecutionDetail } from '@/types/jobs'
import type { PluginServiceCallLog, PluginServiceCallRunnerLog } from '@/types/plugins'
import type { DepartmentResponse } from '@/types/system'
import {
  buildDepartmentNameMap,
  formatDepartmentTooltip,
  resolveDepartmentName,
} from '@/utils/departmentTree'
import { formatDateTime, formatDuration } from '@/utils/format'
import {
  createEmptyLogWindow,
  getLogWindowByteSize,
  getLogWindowContent,
  LOG_WINDOW_MAX_BYTES,
  mergeLogWindowChunk,
} from '@/utils/logWindow'

const route = useRoute()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const detail = ref<JobExecutionDetail>()
const departments = ref<DepartmentResponse[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const logLoading = ref(false)
const logChunk = ref<ExecutionLogChunk>()
const logWindow = shallowRef(createEmptyLogWindow())
const sizeBytes = ref(0)
const truncated = ref(false)
const exists = ref<boolean>()
const limitBytes = ref(64 * 1024)
const tailBytes = ref(256 * 1024)
const autoRefresh = ref(false)
const viewingTail = ref(true)
const logExpanded = ref(false)
const isAtBottom = ref(true)
const isLoadingPreviousLog = ref(false)
const isLoadingNextLog = ref(false)
const logViewerRef = ref<HTMLElement>()
const expandedLogViewerRef = ref<HTMLElement>()
const serviceCalls = ref<PluginServiceCallLog[]>([])
const serviceCallsLoading = ref(false)
const serviceCallsPage = ref(1)
const serviceCallsSize = ref(10)
const serviceCallsTotal = ref(0)
const serviceLogVisible = ref(false)
const serviceLogLoading = ref(false)
const serviceLog = ref<PluginServiceCallRunnerLog>()
const serviceLogContent = ref('')
const serviceLogTarget = ref<PluginServiceCallLog>()
let refreshTimer: number | undefined
let departmentLoadSequence = 0

const executionId = computed(() => String(route.params.id))
const canReadDepartments = computed(() => userStore.permissions.includes('system:department:read'))
const departmentNameMap = computed(() => buildDepartmentNameMap(departments.value))
const ownerDepartmentName = computed(() =>
  resolveDepartmentName(
    detail.value?.ownerDepartmentId,
    detail.value?.ownerDepartmentName,
    departmentNameMap.value,
  ),
)
const ownerDepartmentTooltip = computed(() =>
  formatDepartmentTooltip(
    detail.value?.ownerDepartmentId,
    detail.value?.ownerDepartmentName,
    departmentNameMap.value,
  ),
)
const runnerLogPath = computed(
  () => logChunk.value?.runnerLogPath || detail.value?.runnerLogPath || '-',
)
const serviceRunnerLogPath = computed(
  () => serviceLog.value?.runnerLogPath || serviceLogTarget.value?.targetRunnerLogPath || '-',
)
const logSegments = computed(() => logWindow.value.segments)
const hasLogContent = computed(() =>
  logSegments.value.some((segment) => segment.content.length > 0),
)
const displayStartOffset = computed(() => logWindow.value.startOffset)
const displayNextOffset = computed(() => logWindow.value.nextOffset)
const displayedLogBytes = computed(() => getLogWindowByteSize(logWindow.value))
const eof = computed(() => displayNextOffset.value >= sizeBytes.value)
const hasWindowedLog = computed(
  () =>
    exists.value === true &&
    (displayStartOffset.value > 0 || displayNextOffset.value < sizeBytes.value),
)
const canLoadPrevious = computed(() => exists.value === true && displayStartOffset.value > 0)
const canLoadNext = computed(
  () => exists.value === true && (!eof.value || detail.value?.status === 'RUNNING'),
)
const rangeText = computed(
  () => `${formatBytes(displayStartOffset.value)} - ${formatBytes(displayNextOffset.value)}`,
)

const byteOptions = [
  { label: '64 KB', value: 64 * 1024 },
  { label: '256 KB', value: 256 * 1024 },
  { label: '1 MB', value: 1024 * 1024 },
]
const LOG_FOLLOW_TAIL_THRESHOLD_PX = 4
const LOG_LOAD_TRIGGER_THRESHOLD_PX = 48

async function loadDetail(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    detail.value = await getExecution(executionId.value)
  } finally {
    if (showLoading) loading.value = false
  }
}

async function loadDepartmentDirectory() {
  const sequence = ++departmentLoadSequence
  if (!canReadDepartments.value) {
    departments.value = []
    return
  }
  try {
    const result = await listDepartments()
    if (sequence === departmentLoadSequence && canReadDepartments.value) departments.value = result
  } catch {
    if (sequence === departmentLoadSequence) departments.value = []
    // 部门目录不参与详情和日志刷新；失败时使用 DTO 快照或部门 ID。
  }
}

async function loadServiceCalls() {
  if (!detail.value?.jobId) return

  serviceCallsLoading.value = true
  try {
    const response = await listPluginServiceCalls({
      jobId: detail.value.jobId,
      page: serviceCallsPage.value,
      size: serviceCallsSize.value,
    })
    serviceCalls.value = response.items
    serviceCallsPage.value = response.page
    serviceCallsSize.value = response.size
    serviceCallsTotal.value = response.total
  } finally {
    serviceCallsLoading.value = false
  }
}

async function loadTailLog() {
  await loadLogChunk(() => getExecutionLogs(executionId.value, { tailBytes: tailBytes.value }), {
    mode: 'replace',
    tail: true,
  })
}

async function loadPreviousLog() {
  await loadPreviousLogChunk(getActiveLogViewer(), false)
}

async function loadPreviousLogChunk(viewer = getActiveLogViewer(), preserveScroll = true) {
  if (!canLoadPrevious.value || logLoading.value || isLoadingPreviousLog.value) return

  const anchor = preserveScroll
    ? captureLogSegmentAnchor(viewer, logSegments.value[0]?.key)
    : undefined
  const previousScrollHeight = viewer?.scrollHeight ?? 0
  const previousScrollTop = viewer?.scrollTop ?? 0
  const offset = Math.max(0, displayStartOffset.value - limitBytes.value)

  isLoadingPreviousLog.value = true
  try {
    await loadLogChunk(
      () => getExecutionLogs(executionId.value, { offset, limitBytes: limitBytes.value }),
      {
        mode: 'prepend',
        tail: false,
      },
    )
  } finally {
    isLoadingPreviousLog.value = false
  }

  if (!viewer || !preserveScroll) return
  await nextTick()
  if (restoreLogSegmentAnchor(viewer, anchor)) return
  viewer.scrollTop = previousScrollTop + Math.max(0, viewer.scrollHeight - previousScrollHeight)
}

async function loadNextLog(force = false, forceFollowTail = false) {
  if ((!force && !canLoadNext.value) || isLoadingNextLog.value || exists.value !== true) return

  isLoadingNextLog.value = true
  try {
    await loadLogChunk(
      () =>
        getExecutionLogs(executionId.value, {
          offset: displayNextOffset.value,
          limitBytes: limitBytes.value,
        }),
      { mode: 'append', tail: false },
    )
  } finally {
    isLoadingNextLog.value = false
  }

  if (forceFollowTail || isAtBottom.value) await scrollLogToBottom(true)
}

async function loadNextLogFromButton() {
  await loadNextLog(false, true)
}

async function refreshAll() {
  await Promise.all([loadDetail(), loadTailLog()])
  await loadServiceCalls()
  if (detail.value?.status === 'RUNNING') autoRefresh.value = true
}

async function changeServiceCallsPage(value: number) {
  serviceCallsPage.value = value
  await loadServiceCalls()
}

async function changeServiceCallsSize(value: number) {
  serviceCallsSize.value = value
  serviceCallsPage.value = 1
  await loadServiceCalls()
}

async function copyLogContent() {
  const content = getLogWindowContent(logWindow.value)
  if (!content) {
    ElMessage.warning('当前日志窗口暂无内容可复制')
    return
  }

  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('当前日志窗口内容已复制到剪贴板')
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = content
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    ElMessage.success('当前日志窗口内容已复制')
  }
}

async function openServiceLog(row: PluginServiceCallLog) {
  serviceLogTarget.value = row
  serviceLogVisible.value = true
  serviceLogLoading.value = true
  serviceLog.value = undefined
  serviceLogContent.value = ''
  try {
    const log = await getPluginServiceCallRunnerLog(row.id, { tailBytes: 64 * 1024 })
    serviceLog.value = log
    serviceLogContent.value = log.content
  } finally {
    serviceLogLoading.value = false
  }
}

async function refreshLiveLog() {
  if (logLoading.value) return

  const wasRunning = detail.value?.status === 'RUNNING'
  if (wasRunning) await loadDetail(false)

  if (wasRunning && detail.value?.status !== 'RUNNING') await loadServiceCalls()

  if (exists.value === false) {
    if (detail.value?.status !== 'RUNNING') autoRefresh.value = false
    return
  }

  if (canLoadNext.value || wasRunning) {
    await loadNextLog(wasRunning)
  }

  if (!canLoadNext.value && detail.value?.status !== 'RUNNING') autoRefresh.value = false
}

async function loadLogChunk(
  fetcher: () => Promise<ExecutionLogChunk>,
  options: { mode: 'replace' | 'prepend' | 'append'; tail: boolean },
) {
  logLoading.value = true
  try {
    const chunk = await fetcher()
    applyLogChunk(chunk, options)
  } finally {
    logLoading.value = false
  }
}

function applyLogChunk(
  chunk: ExecutionLogChunk,
  options: { mode: 'replace' | 'prepend' | 'append'; tail: boolean },
) {
  logChunk.value = chunk
  exists.value = chunk.exists
  sizeBytes.value = chunk.sizeBytes
  truncated.value = chunk.truncated
  logWindow.value = mergeLogWindowChunk(logWindow.value, chunk, options.mode)

  viewingTail.value = options.tail || displayNextOffset.value >= sizeBytes.value
  if (options.mode === 'replace' && viewingTail.value) void scrollLogToBottom(true)
}

interface LogScrollAnchor {
  key: string
  top: number
}

function captureLogSegmentAnchor(viewer?: HTMLElement, key?: string): LogScrollAnchor | undefined {
  if (!viewer || !key) return undefined
  const element = viewer.querySelector<HTMLElement>(`[data-log-segment-key="${key}"]`)
  if (!element) return undefined
  return { key, top: element.getBoundingClientRect().top }
}

function restoreLogSegmentAnchor(viewer: HTMLElement, anchor?: LogScrollAnchor) {
  if (!anchor) return false
  const element = viewer.querySelector<HTMLElement>(`[data-log-segment-key="${anchor.key}"]`)
  if (!element) return false
  viewer.scrollTop += element.getBoundingClientRect().top - anchor.top
  return true
}

function getActiveLogViewer() {
  return logExpanded.value ? expandedLogViewerRef.value : logViewerRef.value
}

async function scrollLogToBottom(force = false) {
  await nextTick()
  const viewer = getActiveLogViewer()
  if (!viewer || (!force && !viewingTail.value)) return
  viewer.scrollTop = viewer.scrollHeight
  isAtBottom.value = true
}

function handleLogScroll(event: Event) {
  const target = event.currentTarget as HTMLElement
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  isAtBottom.value = distanceToBottom <= LOG_FOLLOW_TAIL_THRESHOLD_PX

  if (!logLoading.value && target.scrollTop <= 24 && canLoadPrevious.value) {
    void loadPreviousLogChunk(target, true)
    return
  }

  if (!logLoading.value && distanceToBottom <= LOG_LOAD_TRIGGER_THRESHOLD_PX && canLoadNext.value) {
    void loadNextLog()
  }
}

function expandLogViewer() {
  logExpanded.value = true
  void nextTick(scrollLogToBottom)
}

function collapseLogViewer() {
  logExpanded.value = false
  void nextTick(scrollLogToBottom)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && logExpanded.value) collapseLogViewer()
}

function formatJson(value?: string | null) {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function formatBytes(value?: number | null) {
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function formatMillis(value?: number | null) {
  return typeof value === 'number' ? `${value}ms` : '-'
}

function successTagType(success: boolean) {
  return success ? 'success' : 'danger'
}

function serviceCallError(row: PluginServiceCallLog) {
  if (row.errorMessage) return row.errorMessage
  if (row.errorType) return row.errorType
  return '-'
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = window.setInterval(() => {
    void refreshLiveLog()
  }, 5000)
}

function stopAutoRefresh() {
  if (!refreshTimer) return
  window.clearInterval(refreshTimer)
  refreshTimer = undefined
}

watch(autoRefresh, (enabled) => {
  if (enabled) startAutoRefresh()
  else stopAutoRefresh()
})

watch(
  [canReadDepartments, () => resourceStore.revisions.departments],
  () => {
    void loadDepartmentDirectory()
  },
  { immediate: true },
)

watch(logExpanded, (expanded) => {
  document.body.style.overflow = expanded ? 'hidden' : ''
  if (expanded) void nextTick(scrollLogToBottom)
})

watch(executionId, () => {
  autoRefresh.value = false
  logChunk.value = undefined
  logWindow.value = createEmptyLogWindow()
  serviceCalls.value = []
  serviceCallsPage.value = 1
  serviceCallsTotal.value = 0
  serviceLogVisible.value = false
  serviceLog.value = undefined
  serviceLogContent.value = ''
  sizeBytes.value = 0
  truncated.value = false
  exists.value = undefined
  void refreshAll()
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void refreshAll()
})

onUnmounted(() => {
  stopAutoRefresh()
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <PageContainer title="执行详情" description="查看执行状态、请求信息、结果和 Runner 日志。">
    <template #extra>
      <PageBackButton fallback="/jobs/executions" />
      <el-button :loading="loading || logLoading" @click="refreshAll">刷新</el-button>
    </template>

    <el-skeleton v-if="loading" animated :rows="8" />
    <el-card v-else-if="detail" class="execution-detail-card" shadow="never">
      <template #header>
        <div class="logs-header">
          <div>
            <div class="logs-title">执行信息</div>
            <div class="logs-subtitle">{{ detail.jobName || detail.id }}</div>
          </div>
          <div class="logs-actions">
            <el-tag>{{ detail.status }}</el-tag>
            <el-button size="small" @click="detailVisible = !detailVisible">
              {{ detailVisible ? '收起详情' : '展开详情' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-descriptions v-if="detailVisible" :column="1" border>
        <el-descriptions-item label="执行 ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="Job">{{ detail.jobName }}</el-descriptions-item>
        <el-descriptions-item label="Job ID">{{ detail.jobId }}</el-descriptions-item>
        <el-descriptions-item label="Plugin ID">{{ detail.pluginId }}</el-descriptions-item>
        <el-descriptions-item label="Installation ID">{{
          detail.pluginInstallationId
        }}</el-descriptions-item>
        <el-descriptions-item label="所有者 ID">{{
          detail.ownerUserId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">
          <el-tooltip
            :content="ownerDepartmentTooltip"
            :disabled="detail.ownerDepartmentId == null"
            placement="top"
          >
            <span>{{ ownerDepartmentName }}</span>
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="Instance ID">{{
          detail.instanceId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="Request ID">{{
          detail.requestId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="触发方式">{{
          detail.triggerType || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag>{{ detail.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="开始时间">{{
          formatDateTime(detail.startedAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{
          formatDateTime(detail.finishedAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatDateTime(detail.createdAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{
          formatDuration(detail.durationMillis)
        }}</el-descriptions-item>
        <el-descriptions-item label="消息">{{ detail.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="结果 JSON">
          <pre class="json-block">{{ formatJson(detail.resultJson) }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="错误类型">{{ detail.errorType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="错误信息">{{
          detail.errorMessage || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="Runner Log Path">{{
          detail.runnerLogPath || '-'
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="logs-card" shadow="never">
      <template #header>
        <div class="logs-header">
          <div>
            <div class="logs-title">执行日志</div>
            <div class="logs-subtitle">{{ runnerLogPath }}</div>
          </div>
          <div class="logs-actions">
            <el-select v-model="limitBytes" size="small" class="byte-select" :disabled="logLoading">
              <el-option
                v-for="option in byteOptions"
                :key="option.value"
                :label="`分段 ${option.label}`"
                :value="option.value"
              />
            </el-select>
            <el-select v-model="tailBytes" size="small" class="byte-select" :disabled="logLoading">
              <el-option
                v-for="option in byteOptions"
                :key="option.value"
                :label="`尾部 ${option.label}`"
                :value="option.value"
              />
            </el-select>
            <el-button size="small" :loading="logLoading" @click="loadTailLog">尾部加载</el-button>
            <el-button
              size="small"
              :loading="isLoadingPreviousLog"
              :disabled="!canLoadPrevious || logLoading"
              @click="loadPreviousLog"
            >
              上一段
            </el-button>
            <el-button
              size="small"
              type="primary"
              :loading="isLoadingNextLog"
              :disabled="!canLoadNext || logLoading"
              @click="loadNextLogFromButton"
            >
              加载更新
            </el-button>
            <el-button size="small" :disabled="!hasLogContent" @click="copyLogContent">
              复制当前窗口
            </el-button>
            <el-button size="small" :disabled="exists === false" @click="expandLogViewer">
              放大
            </el-button>
            <el-switch
              v-model="autoRefresh"
              size="small"
              active-text="自动刷新"
              :disabled="exists === false"
            />
          </div>
        </div>
      </template>

      <div class="log-meta">
        <el-tag size="small" :type="exists === false ? 'danger' : 'info'">
          {{ exists === false ? '日志不存在' : '日志文件' }}
        </el-tag>
        <el-tag size="small" :type="eof ? 'success' : 'warning'">
          {{ eof ? '已到末尾' : '未到末尾' }}
        </el-tag>
        <el-tag v-if="truncated" size="small" type="warning">尾部截断</el-tag>
        <el-tag v-if="hasWindowedLog" size="small" type="info">窗口外内容可重新加载</el-tag>
        <span>范围：{{ rangeText }}</span>
        <span>大小：{{ formatBytes(sizeBytes) }}</span>
        <span>
          窗口：{{ formatBytes(displayedLogBytes) }} / {{ formatBytes(LOG_WINDOW_MAX_BYTES) }}
        </span>
        <span>nextOffset：{{ displayNextOffset }}</span>
      </div>

      <el-skeleton v-if="logLoading && !logChunk" animated :rows="6" />
      <el-empty v-else-if="exists === false" description="Runner 日志文件不存在或尚未生成" />
      <div
        v-else-if="!logExpanded"
        ref="logViewerRef"
        v-loading="logLoading"
        class="terminal-panel"
        @scroll="handleLogScroll"
      >
        <div class="log-scroll-tip">
          <span v-if="isLoadingPreviousLog">加载更早日志中...</span>
          <span v-else-if="!canLoadPrevious">已到最早位置</span>
        </div>
        <pre><span v-if="!hasLogContent">暂无日志内容</span><span
            v-for="segment in logSegments"
            :key="segment.key"
            :data-log-segment-key="segment.key"
            v-text="segment.content"
          ></span></pre>
        <div class="log-scroll-tip log-scroll-tip--bottom">
          <span v-if="isLoadingNextLog">加载更新日志中...</span>
          <span v-else-if="!canLoadNext && exists === true">已到最新位置</span>
        </div>
      </div>
    </el-card>

    <PermissionGuard permission="plugin:audit:read">
      <el-card class="service-calls-card" shadow="never">
        <template #header>
          <div class="logs-header">
            <div>
              <div class="logs-title">关联服务插件调用</div>
              <div class="logs-subtitle">目标服务插件调用记录，不是当前任务 Runner 日志</div>
            </div>
            <div class="logs-actions">
              <el-button size="small" :loading="serviceCallsLoading" @click="loadServiceCalls">
                刷新调用
              </el-button>
            </div>
          </div>
        </template>

        <PaginationTable
          :data="serviceCalls"
          :loading="serviceCallsLoading"
          :total="serviceCallsTotal"
          :page="serviceCallsPage"
          :size="serviceCallsSize"
          empty-text="本次任务没有调用服务插件"
          @page-change="changeServiceCallsPage"
          @size-change="changeServiceCallsSize"
        >
          <el-table-column label="时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column
            prop="callerPluginId"
            label="调用方"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column
            prop="callerInstallationId"
            label="调用实例"
            min-width="220"
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
            prop="targetPluginId"
            label="目标服务"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="targetInstallationId"
            label="目标实例"
            min-width="220"
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
              <el-tag :type="successTagType(row.success)">{{ row.success ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="100">
            <template #default="{ row }">{{ formatMillis(row.durationMillis) }}</template>
          </el-table-column>
          <el-table-column label="错误" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ serviceCallError(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openServiceLog(row)">查看日志</el-button>
            </template>
          </el-table-column>
        </PaginationTable>
      </el-card>
    </PermissionGuard>

    <el-dialog v-model="serviceLogVisible" title="服务插件日志" width="86%" destroy-on-close>
      <div class="log-meta">
        <el-tag size="small" :type="serviceLog?.exists === false ? 'danger' : 'info'">
          {{ serviceLog?.exists === false ? '日志不存在' : '服务插件日志' }}
        </el-tag>
        <el-tag v-if="serviceLog" size="small" :type="serviceLog.eof ? 'success' : 'warning'">
          {{ serviceLog.eof ? '已到末尾' : '未到末尾' }}
        </el-tag>
        <el-tag v-if="serviceLog?.truncated" size="small" type="warning">尾部截断</el-tag>
        <span>目标服务：{{ serviceLogTarget?.targetPluginId || '-' }}</span>
        <span>目标实例：{{ serviceLogTarget?.targetInstallationId || '-' }}</span>
        <span>操作：{{ serviceLogTarget?.operation || '-' }}</span>
      </div>
      <div class="log-meta">
        <span>路径：{{ serviceRunnerLogPath }}</span>
        <span
          >范围：{{ formatBytes(serviceLog?.offset) }} -
          {{ formatBytes(serviceLog?.nextOffset) }}</span
        >
        <span>大小：{{ formatBytes(serviceLog?.sizeBytes) }}</span>
        <span>nextOffset：{{ serviceLog?.nextOffset ?? '-' }}</span>
      </div>
      <el-skeleton v-if="serviceLogLoading" animated :rows="6" />
      <el-empty
        v-else-if="serviceLog?.exists === false"
        description="服务插件日志文件不存在或尚未生成"
      />
      <div v-else v-loading="serviceLogLoading" class="terminal-panel service-log-panel">
        <pre>{{ serviceLogContent || '暂无日志内容' }}</pre>
      </div>
    </el-dialog>

    <Teleport to="body">
      <div v-if="logExpanded" class="log-expanded-shell">
        <div class="log-expanded-backdrop" @click="collapseLogViewer" />
        <section
          class="log-expanded-panel"
          role="dialog"
          aria-modal="true"
          aria-label="放大执行日志"
        >
          <header class="log-expanded-header">
            <div>
              <div class="log-expanded-kicker">Runner Log</div>
              <div class="log-expanded-title">执行日志</div>
              <div class="log-expanded-path">{{ runnerLogPath }}</div>
            </div>
            <div class="log-expanded-actions">
              <span class="log-expanded-hint">Esc 退出</span>
              <el-button size="small" @click="collapseLogViewer">缩小</el-button>
            </div>
          </header>
          <div class="log-meta log-expanded-meta">
            <el-tag size="small" :type="exists === false ? 'danger' : 'info'">
              {{ exists === false ? '日志不存在' : '日志文件' }}
            </el-tag>
            <el-tag size="small" :type="eof ? 'success' : 'warning'">
              {{ eof ? '已到末尾' : '未到末尾' }}
            </el-tag>
            <el-tag v-if="truncated" size="small" type="warning">尾部截断</el-tag>
            <el-tag v-if="hasWindowedLog" size="small" type="info"> 窗口外内容可重新加载 </el-tag>
            <span>范围：{{ rangeText }}</span>
            <span>大小：{{ formatBytes(sizeBytes) }}</span>
            <span>
              窗口：{{ formatBytes(displayedLogBytes) }} /
              {{ formatBytes(LOG_WINDOW_MAX_BYTES) }}
            </span>
            <span>nextOffset：{{ displayNextOffset }}</span>
          </div>
          <div
            ref="expandedLogViewerRef"
            v-loading="logLoading"
            class="terminal-panel terminal-panel--expanded"
            @scroll="handleLogScroll"
          >
            <div class="log-scroll-tip">
              <span v-if="isLoadingPreviousLog">加载更早日志中...</span>
              <span v-else-if="!canLoadPrevious">已到最早位置</span>
            </div>
            <pre><span v-if="!hasLogContent">暂无日志内容</span><span
                v-for="segment in logSegments"
                :key="segment.key"
                :data-log-segment-key="segment.key"
                v-text="segment.content"
              ></span></pre>
            <div class="log-scroll-tip log-scroll-tip--bottom">
              <span v-if="isLoadingNextLog">加载更新日志中...</span>
              <span v-else-if="!canLoadNext && exists === true">已到最新位置</span>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </PageContainer>
</template>

<style scoped>
.json-block {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.execution-detail-card,
.logs-card,
.service-calls-card {
  margin-top: 16px;
}

.logs-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.logs-title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.logs-subtitle {
  max-width: 680px;
  margin-top: 4px;
  overflow: hidden;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.byte-select {
  width: 116px;
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
  max-height: 62vh;
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
  padding: 8px 20px;
  color: #d1fae5;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-scroll-tip {
  display: flex;
  justify-content: center;
  padding: 10px 20px 0;
  color: #94a3b8;
  font-size: 12px;
}

.log-scroll-tip--bottom {
  padding: 0 20px 10px;
}

.log-expanded-shell {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.log-expanded-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 12%, rgba(14, 165, 233, 0.16), transparent 32%),
    rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(10px);
}

.log-expanded-panel {
  position: absolute;
  inset: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
  animation: log-expand-in 160ms ease-out;
}

.log-expanded-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.log-expanded-kicker {
  color: #38bdf8;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.log-expanded-title {
  margin-top: 4px;
  color: #f8fafc;
  font-size: 20px;
  font-weight: 800;
}

.log-expanded-path {
  max-width: min(960px, 68vw);
  margin-top: 6px;
  overflow: hidden;
  color: #94a3b8;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-expanded-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.log-expanded-hint {
  color: #94a3b8;
  font-size: 12px;
}

.log-expanded-meta {
  margin: 0;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
}

.service-log-panel {
  max-height: 56vh;
}

.terminal-panel--expanded {
  flex: 1;
  min-height: 0;
  max-height: none;
  margin: 16px 20px 20px;
  border-color: rgba(56, 189, 248, 0.28);
}

.terminal-panel--expanded pre {
  min-height: 100%;
  font-size: 13px;
}

@keyframes log-expand-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 960px) {
  .logs-header {
    flex-direction: column;
  }

  .logs-actions {
    justify-content: flex-start;
  }

  .log-expanded-panel {
    inset: 10px;
    border-radius: 16px;
  }

  .log-expanded-header {
    flex-direction: column;
  }

  .log-expanded-path {
    max-width: 82vw;
  }

  .terminal-panel--expanded {
    margin: 10px;
  }
}
</style>
