<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { listJobs } from '@/api/jobs'
import {
  createRule,
  deleteRule,
  getRule,
  listAllChannels,
  listRules,
  setRuleEnabled,
  updateRule,
} from '@/api/notifications'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type { JobItem } from '@/types/jobs'
import type {
  NotificationChannelItem,
  NotificationEventType,
  NotificationRuleItem,
  NotificationRulePayload,
  NotificationRuleQuery,
  NotificationRuleUpdatePayload,
} from '@/types/notifications'
import { findRuleJob, stringifyNotificationRuleJobId } from '@/utils/notificationRule'

const resourceStore = useResourceStore()

const eventTypes: NotificationEventType[] = [
  'JOB_EXECUTION_SUCCESS',
  'JOB_EXECUTION_FAILED',
  'JOB_EXECUTION_TIMEOUT',
  'JOB_EXECUTION_CANCELLED',
  'PLUGIN_RUNTIME_START_FAILED',
]
const table = usePagination<NotificationRuleItem, Omit<NotificationRuleQuery, 'page' | 'size'>>(
  { eventType: '', enabled: '', pluginInstallationId: '', jobId: '' },
  (params) => listRules(params),
)
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)
const saving = ref(false)
const editingRuleId = ref<string>()
const formRef = ref<FormInstance>()
const channels = ref<NotificationChannelItem[]>([])
const jobs = ref<JobItem[]>([])
const form = reactive<NotificationRulePayload>({
  ruleId: '',
  displayName: '',
  enabled: true,
  eventType: 'JOB_EXECUTION_FAILED',
  pluginInstallationId: '',
  jobId: '',
  severity: '',
  channelIds: [],
  remark: '',
})
const selectedJob = computed(() => findRuleJob(jobs.value, form.jobId))
const rules: FormRules<NotificationRulePayload> = {
  displayName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  eventType: [{ required: true, message: '请选择事件类型', trigger: 'change' }],
  pluginInstallationId: [{ required: true, message: '请选择插件安装实例', trigger: 'change' }],
  channelIds: [{ required: true, message: '请选择通知渠道', trigger: 'change' }],
}

async function loadAllChannels() {
  channels.value = await listAllChannels()
}

async function loadAllJobs() {
  const size = 100
  const first = await listJobs({ page: 1, size })
  const result = [...first.items]
  for (let page = 2; page <= Math.ceil(first.total / size); page += 1) {
    result.push(...(await listJobs({ page, size })).items)
  }
  jobs.value = result
}

function resetForm() {
  editingRuleId.value = undefined
  Object.assign(form, {
    ruleId: '',
    displayName: '',
    enabled: true,
    eventType: 'JOB_EXECUTION_FAILED' as NotificationEventType,
    pluginInstallationId: '',
    jobId: '',
    severity: '',
    channelIds: [],
    remark: '',
  })
  formRef.value?.clearValidate()
}

async function loadOptions() {
  await Promise.all([loadAllChannels(), loadAllJobs()])
}

async function openCreate() {
  dialogMode.value = 'create'
  resetForm()
  dialogVisible.value = true
  dialogLoading.value = true
  try {
    await loadOptions()
  } finally {
    dialogLoading.value = false
  }
}

async function openEdit(row: NotificationRuleItem) {
  dialogMode.value = 'edit'
  resetForm()
  dialogVisible.value = true
  dialogLoading.value = true
  try {
    const [detail] = await Promise.all([getRule(row.ruleId), loadOptions()])
    editingRuleId.value = detail.ruleId
    Object.assign(form, {
      ruleId: detail.ruleId,
      displayName: detail.displayName,
      enabled: detail.enabled,
      eventType: detail.eventType,
      pluginInstallationId: detail.pluginInstallationId,
      jobId: stringifyNotificationRuleJobId(detail.jobId),
      severity: detail.severity || '',
      channelIds: [...detail.channelIds],
      remark: detail.remark || '',
    })
  } finally {
    dialogLoading.value = false
  }
}

function buildPayload(): NotificationRulePayload {
  return {
    ruleId: form.ruleId || undefined,
    displayName: form.displayName,
    enabled: form.enabled,
    eventType: form.eventType,
    pluginInstallationId: form.pluginInstallationId,
    jobId: stringifyNotificationRuleJobId(form.jobId),
    severity: form.severity,
    channelIds: [...form.channelIds],
    remark: form.remark,
  }
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (selectedJob.value && selectedJob.value.pluginInstallationId !== form.pluginInstallationId) {
    ElMessage.warning('所选任务与插件安装实例不一致')
    return
  }
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      await createRule(buildPayload())
      ElMessage.success('通知规则已创建')
    } else if (editingRuleId.value) {
      const data = buildPayload()
      delete data.ruleId
      await updateRule(editingRuleId.value, data as NotificationRuleUpdatePayload)
      ElMessage.success('通知规则已更新')
    }
    dialogVisible.value = false
    resourceStore.invalidate('notificationRules')
    await table.load()
  } finally {
    saving.value = false
  }
}

async function toggle(row: NotificationRuleItem) {
  await useConfirmAction({
    title: row.enabled ? '禁用规则' : '启用规则',
    message: `确认${row.enabled ? '禁用' : '启用'}规则「${row.displayName}」？`,
    successMessage: '规则状态已更新',
    action: () => setRuleEnabled(row.ruleId, !row.enabled),
  })
  resourceStore.invalidate('notificationRules')
  await table.load()
}

async function remove(row: NotificationRuleItem) {
  await useConfirmAction({
    title: '删除规则',
    message: `确认删除通知规则「${row.displayName}」？`,
    successMessage: '规则已删除',
    action: () => deleteRule(row.ruleId),
  })
  resourceStore.invalidate('notificationRules')
  await table.load()
}

watch(
  () => form.jobId,
  () => {
    if (selectedJob.value) form.pluginInstallationId = selectedJob.value.pluginInstallationId
  },
)

watch(
  () => form.eventType,
  (value) => {
    if (value === 'PLUGIN_RUNTIME_START_FAILED') form.jobId = ''
  },
)

onMounted(table.load)
watch(
  () => resourceStore.revisions.notificationRules,
  () => {
    if (!table.loading.value && !saving.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="通知规则"
    description="宿主执行完成通知规则；与插件主动推送渠道池相互独立。"
  >
    <template #extra
      ><PermissionGuard permission="notification:rule:write"
        ><el-button type="primary" @click="openCreate">创建规则</el-button></PermissionGuard
      ></template
    >
    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="事件类型"
        ><el-select v-model="table.query.eventType" clearable style="width: 230px"
          ><el-option
            v-for="event in eventTypes"
            :key="event"
            :label="event"
            :value="event" /></el-select
      ></el-form-item>
      <el-form-item label="安装实例"
        ><PluginInstallationSelect
          v-model="table.query.pluginInstallationId"
          usage="NOTIFICATION"
          width="260px"
      /></el-form-item>
      <el-form-item label="Job ID"
        ><el-input v-model="table.query.jobId" clearable style="width: 120px"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select v-model="table.query.enabled" clearable style="width: 120px"
          ><el-option label="启用" :value="true" /><el-option
            label="禁用"
            :value="false" /></el-select
      ></el-form-item>
      <el-form-item
        ><el-button type="primary" @click="table.load">查询</el-button
        ><el-button @click="table.reset">重置</el-button></el-form-item
      >
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
      <el-table-column prop="displayName" label="规则名称" min-width="170" />
      <el-table-column prop="eventType" label="事件类型" min-width="230" />
      <el-table-column
        prop="pluginInstallationId"
        label="Installation ID"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="150" />
      <el-table-column prop="jobId" label="Job ID" width="100" />
      <el-table-column label="渠道数" width="90"
        ><template #default="{ row }">{{ row.channelIds.length }}</template></el-table-column
      >
      <el-table-column label="所有者/部门" min-width="180"
        ><template #default="{ row }"><OwnerSummary v-bind="row" /></template
      ></el-table-column>
      <el-table-column label="状态" width="90"
        ><template #default="{ row }"
          ><el-tag :type="row.enabled ? 'success' : 'info'">{{
            row.enabled ? '启用' : '禁用'
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="操作" width="200" fixed="right"
        ><template #default="{ row }"
          ><PermissionGuard permission="notification:rule:write"
            ><el-button link type="primary" @click="openEdit(row)">编辑</el-button
            ><el-button link type="warning" @click="toggle(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button
            ><el-button link type="danger" @click="remove(row)">删除</el-button></PermissionGuard
          ></template
        ></el-table-column
      >
    </PaginationTable>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '创建通知规则' : '编辑通知规则'"
      width="760px"
      destroy-on-close
    >
      <el-skeleton v-if="dialogLoading" animated :rows="8" />
      <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="140px">
        <el-alert
          title="规则渠道使用当前可读通知渠道，不受插件主动推送池限制。"
          type="info"
          :closable="false"
          style="margin-bottom: 14px"
        />
        <el-form-item label="规则 ID"
          ><el-input
            v-model="form.ruleId"
            :disabled="dialogMode === 'edit'"
            placeholder="可选，由后端生成"
        /></el-form-item>
        <el-form-item label="规则名称" prop="displayName"
          ><el-input v-model="form.displayName"
        /></el-form-item>
        <el-form-item label="事件类型" prop="eventType"
          ><el-select v-model="form.eventType" style="width: 100%"
            ><el-option
              v-for="event in eventTypes"
              :key="event"
              :label="event"
              :value="event" /></el-select
        ></el-form-item>
        <el-form-item label="任务"
          ><el-select
            v-model="form.jobId"
            clearable
            filterable
            style="width: 100%"
            placeholder="可选；选择后自动锁定安装实例"
            ><el-option
              v-for="job in jobs"
              :key="job.id"
              :value="String(job.id)"
              :label="`${job.jobName} / ${job.id} / ${job.pluginDisplayName}`" /></el-select
        ></el-form-item>
        <el-form-item label="插件安装实例" prop="pluginInstallationId"
          ><PluginInstallationSelect
            v-model="form.pluginInstallationId"
            usage="NOTIFICATION"
            :disabled="Boolean(form.jobId)"
            width="100%"
        /></el-form-item>
        <el-form-item label="通知渠道" prop="channelIds"
          ><el-select v-model="form.channelIds" multiple filterable style="width: 100%"
            ><el-option
              v-for="channel in channels"
              :key="channel.channelId"
              :value="channel.channelId"
              :label="`${channel.displayName}（${channel.channelType}${channel.enabled ? '' : '，已停用'}）`" /></el-select
        ></el-form-item>
        <el-form-item label="Severity"><el-input v-model="form.severity" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="form.remark" type="textarea" :rows="3"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="dialogLoading" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </PageContainer>
</template>
