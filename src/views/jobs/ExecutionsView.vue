<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { cancelExecution, listExecutions } from '@/api/jobs'
import { listDepartments } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { JobExecutionItem, JobExecutionQuery, JobExecutionStatus } from '@/types/jobs'
import type { DepartmentResponse } from '@/types/system'
import {
  buildDepartmentNameMap,
  formatDepartmentTooltip,
  resolveDepartmentName,
} from '@/utils/departmentTree'
import { formatDateTime, formatDuration } from '@/utils/format'

const executionStatuses: JobExecutionStatus[] = [
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
  'SYSTEM_EXIT',
]

const resourceStore = useResourceStore()
const userStore = useUserStore()
const departments = ref<DepartmentResponse[]>([])
let departmentLoadSequence = 0

const table = usePagination<JobExecutionItem, Omit<JobExecutionQuery, 'page' | 'size'>>(
  { jobId: '', pluginInstallationId: '', pluginId: '', status: '' },
  (params) => listExecutions(params),
)
const canReadDepartments = computed(() => userStore.permissions.includes('system:department:read'))
const departmentNameMap = computed(() => buildDepartmentNameMap(departments.value))

function statusType(status: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'SYSTEM_EXIT') return 'danger'
  if (status === 'TIMEOUT' || status === 'CANCELLED') return 'warning'
  if (status === 'RUNNING') return 'primary'
  return 'info'
}

function searchExecutions() {
  table.page.value = 1
  return table.load()
}

function departmentName(row: JobExecutionItem) {
  return resolveDepartmentName(
    row.ownerDepartmentId,
    row.ownerDepartmentName,
    departmentNameMap.value,
  )
}

function departmentTooltip(row: JobExecutionItem) {
  return formatDepartmentTooltip(
    row.ownerDepartmentId,
    row.ownerDepartmentName,
    departmentNameMap.value,
  )
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
    // 部门目录只是展示增强；失败时执行列表继续显示 DTO 快照或部门 ID。
  }
}

async function cancel(row: JobExecutionItem) {
  await useConfirmAction({
    title: '取消执行',
    message: `确认取消执行记录「${row.id}」？`,
    successMessage: '取消请求已提交',
    action: () => cancelExecution(row.id),
  })
  await table.load()
}

onMounted(table.load)
watch(
  [canReadDepartments, () => resourceStore.revisions.departments],
  () => {
    void loadDepartmentDirectory()
  },
  { immediate: true },
)
watch(
  () => resourceStore.revisions.executions,
  () => table.load(),
)
</script>

<template>
  <PageContainer title="执行记录" description="查看 Job 执行历史、失败状态和运行中任务。">
    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="任务 ID">
        <el-input v-model="table.query.jobId" clearable />
      </el-form-item>
      <el-form-item label="插件 ID">
        <el-input v-model="table.query.pluginId" clearable />
      </el-form-item>
      <el-form-item label="安装实例">
        <PluginInstallationSelect
          v-model="table.query.pluginInstallationId"
          usage="RUNTIME"
          width="260px"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="table.query.status" clearable placeholder="全部" style="width: 170px">
          <el-option
            v-for="status in executionStatuses"
            :key="status"
            :label="status"
            :value="status"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="searchExecutions">查询</el-button>
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
      <el-table-column prop="jobName" label="Job" min-width="110" />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="90" />
      <el-table-column label="开始时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="耗时" width="80">
        <template #default="{ row }">{{ formatDuration(row.durationMillis) }}</template>
      </el-table-column>
      <el-table-column
        prop="pluginInstallationId"
        label="Installation ID"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column prop="ownerUserId" label="所有者 ID" min-width="130" />
      <el-table-column label="部门" min-width="130">
        <template #default="{ row }">
          <el-tooltip
            :content="departmentTooltip(row)"
            :disabled="row.ownerDepartmentId == null"
            placement="top"
          >
            <span>{{ departmentName(row) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <RouterLink :to="`/jobs/executions/${row.id}`">
            <el-button link type="primary">详情</el-button>
          </RouterLink>
          <PermissionGuard permission="job:execution:cancel">
            <el-button v-if="row.status === 'RUNNING'" link type="danger" @click="cancel(row)"
              >取消</el-button
            >
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>
  </PageContainer>
</template>
