<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { deleteJob, listJobs, pauseJob, resumeJob, runJob } from '@/api/jobs'
import { listAllChannels } from '@/api/notifications'
import JsonEditor from '@/components/JsonEditor/JsonEditor.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { ExecutedStatus, JobItem, JobQuery, JobStatus, RunJobPayload } from '@/types/jobs'
import type { NotificationChannelItem } from '@/types/notifications'
import {
  buildNotificationChannelMap,
  formatNotificationChannelList,
  formatNotificationChannelListTooltip,
} from '@/utils/notificationChannel'
import { bestTimeoutUnit, timeoutUnitOptions, type TimeoutUnit } from '@/utils/timeout'

const router = useRouter()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const table = usePagination<JobItem, Omit<JobQuery, 'page' | 'size'>>({}, (params) =>
  listJobs(params),
)
const channels = ref<NotificationChannelItem[]>([])
let channelLoadSequence = 0

const operatingJobId = ref('')
const runDialogVisible = ref(false)
const runJsonValid = ref(true)
const runSubmitting = ref(false)
const runFormRef = ref<FormInstance>()
const runningJob = ref<JobItem>()
const runTimeoutUnit = ref<TimeoutUnit>('MILLISECOND')
const runForm = reactive<Required<Pick<RunJobPayload, 'inputJson'>> & RunJobPayload>({
  inputJson: '{}',
  timeoutMillis: undefined,
})
const selectedRunTimeoutUnit = computed(
  () => timeoutUnitOptions.find((option) => option.value === runTimeoutUnit.value)!,
)
const runTimeoutValue = computed<number | undefined>({
  get: () =>
    runForm.timeoutMillis === undefined
      ? undefined
      : runForm.timeoutMillis / selectedRunTimeoutUnit.value.multiplier,
  set: (value) => {
    runForm.timeoutMillis =
      value === undefined ? undefined : Math.round(value * selectedRunTimeoutUnit.value.multiplier)
  },
})
const minimumRunTimeoutValue = computed(() => 1 / selectedRunTimeoutUnit.value.multiplier)
const canReadNotificationChannels = computed(() =>
  userStore.permissions.includes('notification:channel:read'),
)
const channelMap = computed(() => buildNotificationChannelMap(channels.value))

const runRules: FormRules<RunJobPayload> = {
  timeoutMillis: [
    {
      validator: (_rule, value, callback) => {
        if (value !== undefined && Number(value) <= 0) callback(new Error('超时时间必须大于 0'))
        else callback()
      },
      trigger: 'change',
    },
  ],
}

function jobStatusText(status: JobStatus) {
  return status === 'ENABLED' ? '已启用' : '已暂停'
}

function executedStatusText(status?: ExecutedStatus) {
  if (status === 'RUNNING') return '执行中'
  if (status === 'IDLE') return '空闲'
  return '-'
}

function channelListText(row: JobItem) {
  return formatNotificationChannelList(row.notificationChannelIds, channelMap.value)
}

function channelListTooltip(row: JobItem) {
  return formatNotificationChannelListTooltip(row.notificationChannelIds, channelMap.value)
}

async function loadChannelDirectory() {
  const sequence = ++channelLoadSequence
  if (!canReadNotificationChannels.value) {
    channels.value = []
    return
  }
  try {
    const result = await listAllChannels()
    if (sequence === channelLoadSequence && canReadNotificationChannels.value) {
      channels.value = result
    }
  } catch {
    if (sequence === channelLoadSequence) channels.value = []
    // 渠道名称是展示增强；目录失败时主列表继续使用原始 ID。
  }
}

function openRunDialog(row: JobItem) {
  runningJob.value = row
  runForm.inputJson = row.inputJson || '{}'
  runForm.timeoutMillis = row.timeoutMillis
  runTimeoutUnit.value = bestTimeoutUnit(row.timeoutMillis)
  runJsonValid.value = true
  runDialogVisible.value = true
}

async function submitRun() {
  const valid = await runFormRef.value?.validate().catch(() => false)
  if (!valid || !runJsonValid.value || !runningJob.value) return

  await ElMessageBox.confirm(`确认立即运行 Job「${runningJob.value.jobName}」？`, '手动运行 Job', {
    type: 'warning',
    confirmButtonText: '确认运行',
    cancelButtonText: '取消',
  })

  runSubmitting.value = true
  try {
    const payload: RunJobPayload = { inputJson: runForm.inputJson || '{}' }
    if (runForm.timeoutMillis) payload.timeoutMillis = runForm.timeoutMillis
    const result = await runJob(runningJob.value.id, payload)
    ElMessage.success('执行请求已提交')
    runDialogVisible.value = false
    resourceStore.invalidate('jobs', 'executions')
    await table.load()
    if (result && typeof result === 'object' && result.executionId) {
      router.push(`/jobs/executions/${result.executionId}`)
    }
  } finally {
    runSubmitting.value = false
  }
}

function isOperating(row: JobItem) {
  return operatingJobId.value === String(row.id)
}

async function toggleJobSchedule(row: JobItem) {
  const isEnabled = row.jobStatus === 'ENABLED'
  const label = isEnabled ? '暂停' : '恢复'
  operatingJobId.value = String(row.id)
  try {
    await useConfirmAction({
      title: `${label} Job`,
      message: `确认${label} Job「${row.jobName}」？`,
      successMessage: `Job 已${label}`,
      action: () => (isEnabled ? pauseJob(row.id) : resumeJob(row.id)),
    })
    resourceStore.invalidate('jobs')
    await table.load()
  } finally {
    operatingJobId.value = ''
  }
}

async function remove(row: JobItem) {
  await useConfirmAction({
    title: '删除 Job',
    message: `确认删除 Job「${row.jobName}」？删除后该 Job 的执行历史也会一并删除。`,
    successMessage: 'Job 已删除',
    action: () => deleteJob(row.id),
  })
  resourceStore.invalidate('jobs', 'executions')
  await table.load()
}

onMounted(table.load)
watch(
  [canReadNotificationChannels, () => resourceStore.revisions.notificationChannels],
  () => {
    void loadChannelDirectory()
  },
  { immediate: true },
)
watch(
  () => resourceStore.revisions.jobs,
  () => {
    if (!table.loading.value && !operatingJobId.value && !runSubmitting.value) void table.load()
  },
)
</script>

<template>
  <PageContainer title="Job 管理" description="维护插件定时任务、Cron 表达式和执行策略。">
    <template #extra>
      <PermissionGuard permission="job:write">
        <RouterLink to="/jobs/create"><el-button type="primary">创建 Job</el-button></RouterLink>
      </PermissionGuard>
    </template>

    <PaginationTable
      :data="table.items.value"
      :loading="table.loading.value"
      :total="table.total.value"
      :page="table.page.value"
      :size="table.size.value"
      @page-change="table.changePage"
      @size-change="table.changeSize"
    >
      <el-table-column prop="jobName" label="Job 名称" min-width="160" />
      <el-table-column prop="pluginDisplayName" label="插件" min-width="150" />
      <el-table-column prop="cronExpression" label="Cron" min-width="180" />
      <el-table-column label="调度状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.jobStatus === 'ENABLED' ? 'success' : 'info'">
            {{ jobStatusText(row.jobStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="执行状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.executedStatus === 'RUNNING' ? 'warning' : 'info'">
            {{ executedStatusText(row.executedStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="主动推送渠道" min-width="150">
        <template #default="{ row }">
          <el-tooltip
            :content="channelListTooltip(row)"
            :disabled="!row.notificationChannelIds.length"
            placement="top"
          >
            <div class="channel-list">{{ channelListText(row) }}</div>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="misfirePolicy" label="错过策略" min-width="180" />
      <el-table-column label="所有者/部门" min-width="180">
        <template #default="{ row }"><OwnerSummary v-bind="row" /></template>
      </el-table-column>
      <el-table-column
        prop="pluginInstallationId"
        label="Installation ID"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="job:run">
            <el-button link type="success" @click="openRunDialog(row)">运行</el-button>
          </PermissionGuard>
          <PermissionGuard permission="job:write">
            <el-button
              link
              type="warning"
              :loading="isOperating(row)"
              @click="toggleJobSchedule(row)"
            >
              {{ row.jobStatus === 'DISABLED' ? '恢复' : '暂停' }}
            </el-button>
            <RouterLink :to="`/jobs/${row.id}/edit`"
              ><el-button link type="primary">编辑</el-button></RouterLink
            >
          </PermissionGuard>
          <PermissionGuard permission="job:delete">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="runDialogVisible" title="手动运行 Job" width="680px" destroy-on-close>
      <el-alert
        title="inputJson 会作为本次执行输入，不会修改 Job 默认配置。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 14px"
      />
      <el-form ref="runFormRef" :model="runForm" :rules="runRules" label-width="150px">
        <el-form-item label="Job">
          <span
            >{{ runningJob?.jobName }} / {{ runningJob?.pluginDisplayName }} /
            {{ runningJob?.pluginInstallationId }}</span
          >
        </el-form-item>
        <el-form-item label="覆盖超时" prop="timeoutMillis">
          <div class="timeout-input">
            <el-input-number
              v-model="runTimeoutValue"
              :min="minimumRunTimeoutValue"
              :precision="selectedRunTimeoutUnit.precision"
            />
            <el-select v-model="runTimeoutUnit" style="width: 100px">
              <el-option
                v-for="option in timeoutUnitOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="覆盖输入 JSON">
          <JsonEditor
            v-model="runForm.inputJson"
            style="width: 100%"
            @valid-change="runJsonValid = $event"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="runSubmitting"
          :disabled="!runJsonValid"
          @click="submitRun"
        >
          确认运行
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.timeout-input {
  display: flex;
  gap: 8px;
}

.channel-list {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
