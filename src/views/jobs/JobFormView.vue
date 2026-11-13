<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { createJob, getJob, replaceJobNotificationChannels, updateJob } from '@/api/jobs'
import { listAllChannels } from '@/api/notifications'
import { getPluginInstallationNotificationChannels } from '@/api/plugins'
import CronEditor from '@/components/CronEditor/CronEditor.vue'
import JsonEditor from '@/components/JsonEditor/JsonEditor.vue'
import PageBackButton from '@/components/PageBackButton/PageBackButton.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { CreateJobRequest, JobItem, MisfirePolicy, UpdateJobRequest } from '@/types/jobs'
import type { NotificationChannelItem } from '@/types/notifications'
import {
  buildNotificationChannelMap,
  buildNotificationChannelNameCounts,
  formatNotificationChannelOptionLabel,
} from '@/utils/notificationChannel'
import { hasAllPermissions } from '@/utils/permission'
import { bestTimeoutUnit, timeoutUnitOptions, type TimeoutUnit } from '@/utils/timeout'

type ChannelPoolStatus = 'unknown' | 'loading' | 'known' | 'error'

interface JobForm extends UpdateJobRequest {
  notificationChannelIds: string[]
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const resourceStore = useResourceStore()
const formRef = ref<FormInstance>()
const jsonValid = ref(true)
const loading = ref(false)
const saving = ref(false)
const cronValid = ref(false)
const cronError = ref('')
const detail = ref<JobItem>()
const originalInstallationId = ref('')
const originalChannelIds = ref<string[]>([])
const channelPoolStatus = ref<ChannelPoolStatus>('unknown')
const channelPoolIds = ref<string[]>()
const channels = ref<NotificationChannelItem[]>([])
let channelPoolSequence = 0
let channelDirectorySequence = 0
const misfirePolicyOptions: MisfirePolicy[] = [
  'DEFAULT',
  'IGNORE_MISFIRES',
  'FIRE_AND_PROCEED',
  'DO_NOTHING',
]
const timeoutUnit = ref<TimeoutUnit>('MINUTE')
const form = reactive<JobForm>({
  jobName: '',
  pluginInstallationId: '',
  cronExpression: '',
  misfirePolicy: 'DEFAULT',
  inputJson: '{}',
  timeoutMillis: 60_000,
  concurrent: false,
  remark: '',
  notificationChannelIds: [],
})

const isEdit = computed(() => route.name === 'job-edit')
const channelBindingPermissions = [
  'job:write',
  'job:notification:bind',
  'notification:channel:read',
]
const canBindNotificationChannels = computed(() =>
  hasAllPermissions(userStore.permissions, channelBindingPermissions),
)
const canReadNotificationChannels = computed(() =>
  userStore.permissions.includes('notification:channel:read'),
)
const installationChanged = computed(
  () => isEdit.value && form.pluginInstallationId !== originalInstallationId.value,
)
const installationLocked = computed(() => isEdit.value && !canBindNotificationChannels.value)
const channelPoolKnown = computed(
  () => channelPoolStatus.value === 'known' && Array.isArray(channelPoolIds.value),
)
const canEditNotificationChannels = computed(
  () => canBindNotificationChannels.value && channelPoolKnown.value,
)
const channelOptions = computed(() => [
  ...new Set([...(channelPoolIds.value || []), ...form.notificationChannelIds]),
])
const channelMap = computed(() => buildNotificationChannelMap(channels.value))
const channelNameCounts = computed(() => buildNotificationChannelNameCounts(channels.value))
const selectedTimeoutUnit = computed(
  () => timeoutUnitOptions.find((option) => option.value === timeoutUnit.value)!,
)
const timeoutValue = computed<number | undefined>({
  get: () => form.timeoutMillis / selectedTimeoutUnit.value.multiplier,
  set: (value) => {
    form.timeoutMillis =
      value === undefined ? 0 : Math.round(value * selectedTimeoutUnit.value.multiplier)
  },
})
const minimumTimeoutValue = computed(() => 1 / selectedTimeoutUnit.value.multiplier)
const rules: FormRules<JobForm> = {
  jobName: [{ required: true, message: '请输入 Job 名称', trigger: 'blur' }],
  pluginInstallationId: [{ required: true, message: '请选择插件安装实例', trigger: 'change' }],
  cronExpression: [
    { required: true, message: '请输入 Cron 表达式', trigger: 'blur' },
    {
      validator: (_rule, _value, callback) =>
        cronError.value ? callback(new Error(cronError.value)) : callback(),
      trigger: 'change',
    },
  ],
  timeoutMillis: [
    {
      validator: (_rule, value, callback) =>
        !value || Number(value) <= 0 ? callback(new Error('超时时间必须大于 0')) : callback(),
      trigger: 'change',
    },
  ],
}

function channelOptionLabel(channelId: string) {
  const label = formatNotificationChannelOptionLabel(
    channelId,
    channelMap.value,
    channelNameCounts.value,
  )
  return channelPoolIds.value?.includes(channelId) ? label : `${label}（不在当前实例渠道池）`
}

async function loadChannelDirectory() {
  const sequence = ++channelDirectorySequence
  if (!canReadNotificationChannels.value) {
    channels.value = []
    return
  }
  try {
    const result = await listAllChannels()
    if (sequence === channelDirectorySequence && canReadNotificationChannels.value) {
      channels.value = result
    }
  } catch {
    if (sequence === channelDirectorySequence) channels.value = []
    // 名称目录失败不影响实例渠道池和 Job 表单，选项会回退显示 ID。
  }
}

async function loadJob() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const response = await getJob(String(route.params.id))
    detail.value = response
    originalInstallationId.value = response.pluginInstallationId
    originalChannelIds.value = [...response.notificationChannelIds]
    timeoutUnit.value = bestTimeoutUnit(response.timeoutMillis)
    Object.assign(form, {
      jobName: response.jobName,
      pluginInstallationId: response.pluginInstallationId,
      cronExpression: response.cronExpression,
      misfirePolicy: response.misfirePolicy,
      inputJson: response.inputJson || '{}',
      timeoutMillis: response.timeoutMillis,
      concurrent: response.concurrent,
      remark: response.remark || '',
      notificationChannelIds: [...response.notificationChannelIds],
    })
    await loadChannelPool(response.pluginInstallationId)
  } finally {
    loading.value = false
  }
}

function isChannelIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

async function loadChannelPool(installationId: string) {
  const sequence = ++channelPoolSequence
  channelPoolIds.value = undefined
  channelPoolStatus.value = 'unknown'
  if (!installationId || !canBindNotificationChannels.value) return

  channelPoolStatus.value = 'loading'
  try {
    const response = await getPluginInstallationNotificationChannels(installationId)
    if (sequence !== channelPoolSequence || form.pluginInstallationId !== installationId) return
    if (!isChannelIdList(response)) {
      channelPoolStatus.value = 'error'
      ElMessage.error('实例渠道池响应格式无效，任务渠道编辑保持禁用')
      return
    }
    channelPoolIds.value = [...new Set(response)]
    channelPoolStatus.value = 'known'
  } catch {
    if (sequence === channelPoolSequence && form.pluginInstallationId === installationId) {
      channelPoolStatus.value = 'error'
    }
  }
}

function handleInstallationChange(value: string) {
  if (value === form.pluginInstallationId) return
  form.pluginInstallationId = value
  form.notificationChannelIds = []
  void loadChannelPool(value)
}

function sameChannelIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

function validateChannelSubmission() {
  const channelChange = !sameChannelIds(form.notificationChannelIds, originalChannelIds.value)
  if (!installationChanged.value && !channelChange) return true
  if (!canBindNotificationChannels.value) {
    ElMessage.warning('缺少完整任务渠道绑定权限，不能清空、绑定或切换安装实例')
    return false
  }
  if (!channelPoolKnown.value || !channelPoolIds.value) {
    ElMessage.warning('新实例渠道池尚未成功读取，不能提交任务渠道或切换安装实例')
    return false
  }
  const allowed = new Set(channelPoolIds.value)
  if (form.notificationChannelIds.some((channelId) => !allowed.has(channelId))) {
    ElMessage.warning('任务渠道必须全部来自当前插件实例渠道池')
    return false
  }
  return true
}

function handleCronValidChange(valid: boolean) {
  cronValid.value = valid
  void formRef.value?.validateField('cronExpression').catch(() => undefined)
}

function handleCronMessageChange(message: string) {
  cronError.value = message
  void formRef.value?.validateField('cronExpression').catch(() => undefined)
}

function buildUpdateRequest(): UpdateJobRequest {
  return {
    jobName: form.jobName,
    pluginInstallationId: form.pluginInstallationId,
    cronExpression: form.cronExpression,
    misfirePolicy: form.misfirePolicy,
    inputJson: form.inputJson,
    timeoutMillis: form.timeoutMillis,
    concurrent: form.concurrent,
    remark: form.remark || undefined,
  }
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !jsonValid.value || !cronValid.value) return
  if (isEdit.value && !validateChannelSubmission()) return
  saving.value = true
  try {
    if (isEdit.value) {
      const jobId = String(route.params.id)
      const desiredChannelIds = [...form.notificationChannelIds]
      const channelsChanged = !sameChannelIds(desiredChannelIds, originalChannelIds.value)
      if (installationChanged.value) {
        await ElMessageBox.confirm(
          `将先清空原实例的 ${originalChannelIds.value.length} 个任务渠道，再更新安装实例，最后绑定新实例渠道池中的 ${desiredChannelIds.length} 个渠道。是否继续？`,
          '更换实例并重新绑定渠道',
          { type: 'warning', confirmButtonText: '清空并继续', cancelButtonText: '取消' },
        )
        await replaceJobNotificationChannels(jobId, [])
        resourceStore.invalidate('jobs')
        originalChannelIds.value = []
        const updated = await updateJob(jobId, buildUpdateRequest())
        detail.value = updated
        originalInstallationId.value = form.pluginInstallationId
        const rebound = await replaceJobNotificationChannels(jobId, desiredChannelIds)
        detail.value = rebound
        originalChannelIds.value = [...desiredChannelIds]
      } else {
        const updated = await updateJob(jobId, buildUpdateRequest())
        detail.value = updated
        if (channelsChanged) {
          const rebound = await replaceJobNotificationChannels(jobId, desiredChannelIds)
          detail.value = rebound
          originalChannelIds.value = [...desiredChannelIds]
        }
      }
      ElMessage.success('Job 已更新')
    } else {
      const payload: CreateJobRequest = {
        ...buildUpdateRequest(),
        notificationChannelIds: canEditNotificationChannels.value
          ? [...form.notificationChannelIds]
          : [],
      }
      await createJob(payload)
      ElMessage.success('Job 已创建')
    }
    resourceStore.invalidate('jobs', 'executions')
    await router.push('/jobs/list')
  } finally {
    saving.value = false
  }
}

onMounted(loadJob)
watch(
  [canReadNotificationChannels, () => resourceStore.revisions.notificationChannels],
  () => {
    void loadChannelDirectory()
  },
  { immediate: true },
)
</script>

<template>
  <PageContainer
    :title="isEdit ? '编辑 Job' : '创建 Job'"
    description="任务绑定具体插件安装实例；插件主动推送授权与宿主通知规则相互独立。"
  >
    <template #extra><PageBackButton fallback="/jobs/list" /></template>
    <el-skeleton v-if="loading" animated :rows="8" />
    <el-form v-else ref="formRef" label-width="150px" :model="form" :rules="rules">
      <el-descriptions v-if="detail" :column="2" border style="margin-bottom: 18px">
        <el-descriptions-item label="所有者/部门" :span="2"
          ><OwnerSummary v-bind="detail" compact
        /></el-descriptions-item>
        <el-descriptions-item label="Plugin ID">{{ detail.pluginId }}</el-descriptions-item>
        <el-descriptions-item label="Installation ID">{{
          detail.pluginInstallationId
        }}</el-descriptions-item>
      </el-descriptions>
      <el-form-item label="Job 名称" prop="jobName"
        ><el-input v-model="form.jobName"
      /></el-form-item>
      <el-form-item label="插件安装实例" prop="pluginInstallationId">
        <PluginInstallationSelect
          :model-value="form.pluginInstallationId"
          usage="JOB"
          :disabled="installationLocked"
          placeholder="搜索安装名称、插件名或 Installation ID"
          width="440px"
          @update:model-value="handleInstallationChange"
        />
      </el-form-item>
      <el-alert
        v-if="installationLocked"
        title="当前账号缺少完整任务渠道绑定权限，已有任务的安装实例不可更换。"
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-form-item label="Cron 表达式" prop="cronExpression"
        ><CronEditor
          v-model="form.cronExpression"
          @valid-change="handleCronValidChange"
          @validate-message-change="handleCronMessageChange"
      /></el-form-item>
      <el-form-item label="超时时间" prop="timeoutMillis"
        ><div class="timeout-input">
          <el-input-number
            v-model="timeoutValue"
            :min="minimumTimeoutValue"
            :precision="selectedTimeoutUnit.precision"
          /><el-select v-model="timeoutUnit" style="width: 100px"
            ><el-option
              v-for="option in timeoutUnitOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
          /></el-select></div
      ></el-form-item>
      <el-form-item label="错过策略"
        ><el-select v-model="form.misfirePolicy" style="width: 320px"
          ><el-option
            v-for="policy in misfirePolicyOptions"
            :key="policy"
            :label="policy"
            :value="policy" /></el-select
      ></el-form-item>
      <el-form-item label="允许并发"><el-switch v-model="form.concurrent" /></el-form-item>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" type="textarea" :rows="3"
      /></el-form-item>
      <el-form-item label="输入 JSON"
        ><JsonEditor
          v-model="form.inputJson"
          style="width: 100%"
          @valid-change="jsonValid = $event"
      /></el-form-item>
      <el-divider content-position="left">插件主动推送授权</el-divider>
      <el-alert
        v-if="!canBindNotificationChannels"
        title="缺少任务写入、任务渠道绑定或通知渠道读取权限；渠道编辑和已有任务实例切换均不可用。"
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="!form.pluginInstallationId"
        title="请先选择插件安装实例，再读取它的渠道池。"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="channelPoolStatus === 'loading'"
        title="正在读取当前实例渠道池；成功前不会开放渠道提交。"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="channelPoolStatus === 'error'"
        title="实例渠道池读取失败，保持未知状态；渠道绑定和实例切换均已禁用。"
        type="error"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="channelPoolStatus === 'known'"
        title="任务渠道只能从当前安装实例渠道池选择；切换实例时会严格按清空、更新实例、重新绑定的顺序提交。"
        type="success"
        :closable="false"
        style="margin-bottom: 16px"
      />
      <PermissionGuard :permissions="channelBindingPermissions" mode="all">
        <el-form-item label="任务渠道">
          <el-select
            v-model="form.notificationChannelIds"
            multiple
            filterable
            :disabled="!canEditNotificationChannels"
            placeholder="从当前实例渠道池选择"
            style="width: 100%"
          >
            <el-option
              v-for="channelId in channelOptions"
              :key="channelId"
              :value="channelId"
              :label="channelOptionLabel(channelId)"
            />
          </el-select>
          <el-button
            v-if="form.pluginInstallationId && channelPoolStatus === 'error'"
            style="margin-left: 8px"
            @click="loadChannelPool(form.pluginInstallationId)"
          >
            重试读取
          </el-button>
        </el-form-item>
      </PermissionGuard>
      <el-form-item
        ><PermissionGuard permission="job:write"
          ><el-button
            type="primary"
            :loading="saving"
            :disabled="!jsonValid || !cronValid"
            @click="save"
            >保存</el-button
          ></PermissionGuard
        ><RouterLink to="/jobs/list"><el-button>取消</el-button></RouterLink></el-form-item
      >
    </el-form>
  </PageContainer>
</template>

<style scoped>
.timeout-input {
  display: flex;
  gap: 8px;
}
</style>
