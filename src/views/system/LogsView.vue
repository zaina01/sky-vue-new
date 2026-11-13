<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'

import { listLoginLogs, listSystemLogs, runRetentionCleanup } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { usePagination } from '@/composables/usePagination'
import type {
  LoginLogItem,
  LoginLogQuery,
  RetentionCleanupCategory,
  RetentionCleanupResponse,
  SystemLogItem,
  SystemLogQuery,
} from '@/types/system'
import { formatDateTime } from '@/utils/format'

const cleanupCategories: Array<{ label: string; value: RetentionCleanupCategory }> = [
  { label: '任务执行记录', value: 'JOB_EXECUTION' },
  { label: '插件任务日志', value: 'PLUGIN_TASK_LOG' },
  { label: '插件审计日志', value: 'PLUGIN_AUDIT_LOG' },
  { label: '登录日志', value: 'LOGIN_LOG' },
  { label: '系统操作日志', value: 'SYSTEM_LOG' },
  { label: '通知发送历史', value: 'NOTIFICATION_SEND_HISTORY' },
]

const activeTab = ref('system')
const loginLoaded = ref(false)
const systemTable = usePagination<SystemLogItem, Omit<SystemLogQuery, 'page' | 'size'>>(
  {
    module: '',
    action: '',
    level: '',
    status: '',
    operatorUserId: '',
    operatorName: '',
    sourceType: '',
    targetType: '',
    targetId: '',
    startTime: '',
    endTime: '',
  },
  (params) => listSystemLogs(params),
)
const loginTable = usePagination<LoginLogItem, Omit<LoginLogQuery, 'page' | 'size'>>(
  {
    username: '',
    userId: '',
    status: '',
    loginIp: '',
    deviceType: '',
    startTime: '',
    endTime: '',
  },
  (params) => listLoginLogs(params),
)

const cleanupDialogVisible = ref(false)
const cleanupRunning = ref(false)
const cleanupResult = ref<RetentionCleanupResponse>()
const cleanupForm = reactive({
  categories: [] as RetentionCleanupCategory[],
})

function statusType(status: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

function categoryLabel(category: RetentionCleanupCategory) {
  return cleanupCategories.find((item) => item.value === category)?.label || category
}

function openCleanupDialog() {
  cleanupResult.value = undefined
  cleanupForm.categories = []
  cleanupDialogVisible.value = true
}

async function executeCleanup(dryRun: boolean) {
  cleanupRunning.value = true
  try {
    cleanupResult.value = await runRetentionCleanup({
      dryRun,
      confirm: dryRun ? undefined : true,
      categories: cleanupForm.categories,
    })
    ElMessage.success(dryRun ? '预演完成' : '清理完成')
  } finally {
    cleanupRunning.value = false
  }
}

watch(activeTab, (value) => {
  if (value === 'login' && !loginLoaded.value) {
    loginLoaded.value = true
    loginTable.load()
  }
})

systemTable.load()
</script>

<template>
  <PageContainer title="系统日志" description="审计后台操作、登录行为和日志数据清理。">
    <template #extra>
      <PermissionGuard permission="system:retention:cleanup">
        <el-button type="danger" plain @click="openCleanupDialog">日志数据清理</el-button>
      </PermissionGuard>
    </template>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="操作日志" name="system">
        <el-form class="search-form" inline :model="systemTable.query">
          <el-form-item label="模块">
            <el-input v-model="systemTable.query.module" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="动作">
            <el-input v-model="systemTable.query.action" clearable style="width: 160px" />
          </el-form-item>
          <el-form-item label="级别">
            <el-select
              v-model="systemTable.query.level"
              clearable
              placeholder="全部"
              style="width: 120px"
            >
              <el-option label="INFO" value="INFO" />
              <el-option label="WARN" value="WARN" />
              <el-option label="ERROR" value="ERROR" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="systemTable.query.status"
              clearable
              placeholder="全部"
              style="width: 130px"
            >
              <el-option label="SUCCESS" value="SUCCESS" />
              <el-option label="FAILED" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作人">
            <el-input v-model="systemTable.query.operatorName" clearable style="width: 140px" />
          </el-form-item>
          <el-form-item label="来源">
            <el-input v-model="systemTable.query.sourceType" clearable style="width: 130px" />
          </el-form-item>
          <el-form-item label="目标类型">
            <el-input v-model="systemTable.query.targetType" clearable style="width: 130px" />
          </el-form-item>
          <el-form-item label="目标 ID">
            <el-input v-model="systemTable.query.targetId" clearable style="width: 170px" />
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="systemTable.query.startTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="开始时间"
              style="width: 190px"
            />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker
              v-model="systemTable.query.endTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="结束时间"
              style="width: 190px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="systemTable.load">查询</el-button>
            <el-button @click="systemTable.reset">重置</el-button>
          </el-form-item>
        </el-form>

        <PaginationTable
          :data="systemTable.items.value"
          :loading="systemTable.loading.value"
          :total="systemTable.total.value"
          :page="systemTable.page.value"
          :size="systemTable.size.value"
          @page-change="systemTable.changePage"
          @size-change="systemTable.changeSize"
        >
          <el-table-column prop="operatorName" label="操作人" min-width="120" />
          <el-table-column prop="ownerDepartmentId" label="归属部门 ID" min-width="120">
            <template #default="{ row }">{{ row.ownerDepartmentId ?? '-' }}</template>
          </el-table-column>
          <el-table-column prop="module" label="模块" min-width="140" />
          <el-table-column prop="action" label="动作" min-width="170" />
          <el-table-column prop="level" label="级别" width="100" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="requestMethod" label="方法" width="90" />
          <el-table-column
            prop="requestUri"
            label="请求 URI"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column prop="ip" label="IP" min-width="130" />
          <el-table-column prop="targetType" label="目标类型" min-width="120" />
          <el-table-column prop="targetId" label="目标 ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="message" label="消息" min-width="220" show-overflow-tooltip />
          <el-table-column label="时间" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
          </el-table-column>
        </PaginationTable>
      </el-tab-pane>

      <el-tab-pane label="登录日志" name="login">
        <el-form class="search-form" inline :model="loginTable.query">
          <el-form-item label="用户名">
            <el-input v-model="loginTable.query.username" clearable style="width: 140px" />
          </el-form-item>
          <el-form-item label="用户 ID">
            <el-input v-model="loginTable.query.userId" clearable style="width: 180px" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="loginTable.query.status"
              clearable
              placeholder="全部"
              style="width: 130px"
            >
              <el-option label="SUCCESS" value="SUCCESS" />
              <el-option label="FAILED" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item label="登录 IP">
            <el-input v-model="loginTable.query.loginIp" clearable style="width: 140px" />
          </el-form-item>
          <el-form-item label="设备">
            <el-input v-model="loginTable.query.deviceType" clearable style="width: 120px" />
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="loginTable.query.startTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="开始时间"
              style="width: 190px"
            />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker
              v-model="loginTable.query.endTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="结束时间"
              style="width: 190px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loginTable.load">查询</el-button>
            <el-button @click="loginTable.reset">重置</el-button>
          </el-form-item>
        </el-form>

        <PaginationTable
          :data="loginTable.items.value"
          :loading="loginTable.loading.value"
          :total="loginTable.total.value"
          :page="loginTable.page.value"
          :size="loginTable.size.value"
          @page-change="loginTable.changePage"
          @size-change="loginTable.changeSize"
        >
          <el-table-column prop="username" label="用户名" min-width="130" />
          <el-table-column prop="userId" label="用户 ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="ownerDepartmentId" label="归属部门 ID" min-width="120">
            <template #default="{ row }">{{ row.ownerDepartmentId ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="loginIp" label="登录 IP" min-width="140" />
          <el-table-column prop="ipType" label="IP 类型" width="110" />
          <el-table-column prop="deviceType" label="设备" width="100" />
          <el-table-column prop="requestMethod" label="方法" width="90" />
          <el-table-column
            prop="requestUri"
            label="请求 URI"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="failReason"
            label="失败原因"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column label="时间" min-width="180">
            <template #default="{ row }">{{ formatDateTime(row.loginTime) }}</template>
          </el-table-column>
        </PaginationTable>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="cleanupDialogVisible" title="日志数据清理" width="860px" destroy-on-close>
      <el-alert
        title="dry-run 只统计候选数量；实际清理会提交 confirm=true，请先预演确认范围。"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom: 14px"
      />
      <el-form label-width="110px">
        <el-form-item label="清理分类">
          <el-select
            v-model="cleanupForm.categories"
            multiple
            clearable
            placeholder="留空表示全部分类"
            style="width: 100%"
          >
            <el-option
              v-for="category in cleanupCategories"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <el-descriptions v-if="cleanupResult" :column="3" border style="margin-bottom: 14px">
        <el-descriptions-item label="功能启用">{{
          cleanupResult.enabled ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item label="预演">{{
          cleanupResult.dryRun ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item label="候选总数">{{
          cleanupResult.totalCandidateCount
        }}</el-descriptions-item>
        <el-descriptions-item label="删除总数">{{
          cleanupResult.totalDeletedCount
        }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{
          formatDateTime(cleanupResult.startedAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{
          formatDateTime(cleanupResult.finishedAt)
        }}</el-descriptions-item>
      </el-descriptions>

      <el-table v-if="cleanupResult" :data="cleanupResult.items" border>
        <el-table-column label="分类" min-width="190">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="截止时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.cutoff) }}</template>
        </el-table-column>
        <el-table-column prop="retentionDays" label="保留天数" width="100" />
        <el-table-column prop="candidateCount" label="候选数" width="100" />
        <el-table-column prop="deletedCount" label="删除数" width="100" />
        <el-table-column prop="skippedReason" label="跳过原因" min-width="220" />
      </el-table>

      <template #footer>
        <el-button @click="cleanupDialogVisible = false">关闭</el-button>
        <el-button :loading="cleanupRunning" @click="executeCleanup(true)">预演</el-button>
        <el-button type="danger" :loading="cleanupRunning" @click="executeCleanup(false)">
          确认清理
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>
