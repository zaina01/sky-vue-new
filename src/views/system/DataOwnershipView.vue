<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { listJobs } from '@/api/jobs'
import { listChannels, listRules } from '@/api/notifications'
import { listPluginInstallations } from '@/api/plugins'
import { listUsers, transferDataOwnership } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { JobItem } from '@/types/jobs'
import type { NotificationChannelItem, NotificationRuleItem } from '@/types/notifications'
import type { PluginInstallationResponse } from '@/types/plugins'
import type { DataOwnershipTransferResponse, UserItem } from '@/types/system'

const route = useRoute()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const targetUserId = ref('')
const targetUsers = ref<UserItem[]>([])
const targetLoading = ref(false)
const selectedTarget = computed(() =>
  targetUsers.value.find((item) => item.userId === targetUserId.value),
)
const sourceUserId = computed(() =>
  typeof route.query.sourceUserId === 'string' ? route.query.sourceUserId : '',
)

const installationTable = usePagination<PluginInstallationResponse, Record<string, never>>(
  {},
  (params) => listPluginInstallations(params),
)
const jobTable = usePagination<JobItem, Record<string, never>>({}, (params) => listJobs(params))
const channelTable = usePagination<NotificationChannelItem, Record<string, never>>({}, (params) =>
  listChannels(params),
)
const ruleTable = usePagination<NotificationRuleItem, Record<string, never>>({}, (params) =>
  listRules(params),
)

const selectedInstallationIds = ref(new Set<string>())
const selectedJobIds = ref(new Set<number>())
const selectedChannelIds = ref(new Set<string>())
const selectedRuleIds = ref(new Set<string>())
const submitting = ref(false)
const resultVisible = ref(false)
const transferResult = ref<DataOwnershipTransferResponse>()

const totalSelected = computed(
  () =>
    selectedInstallationIds.value.size +
    selectedJobIds.value.size +
    selectedChannelIds.value.size +
    selectedRuleIds.value.size,
)

function toggleStringSet(source: { value: Set<string> }, value: string, checked: boolean) {
  const next = new Set(source.value)
  if (checked) next.add(value)
  else next.delete(value)
  source.value = next
}

function toggleInstallation(id: string, checked: boolean) {
  toggleStringSet(selectedInstallationIds, id, checked)
}

function toggleJob(id: number, checked: boolean) {
  const next = new Set(selectedJobIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedJobIds.value = next
}

function toggleChannel(id: string, checked: boolean) {
  toggleStringSet(selectedChannelIds, id, checked)
}

function toggleRule(id: string, checked: boolean) {
  toggleStringSet(selectedRuleIds, id, checked)
}

async function searchTargetUsers(keyword = '') {
  targetLoading.value = true
  try {
    const response = await listUsers({ page: 1, size: 30, username: keyword, enabled: true })
    targetUsers.value = response.items
  } finally {
    targetLoading.value = false
  }
}

function clearSelections() {
  selectedInstallationIds.value = new Set()
  selectedJobIds.value = new Set()
  selectedChannelIds.value = new Set()
  selectedRuleIds.value = new Set()
}

async function submitTransfer() {
  const target = selectedTarget.value
  if (!target) {
    ElMessage.warning('请选择启用的目标用户')
    return
  }
  if (target.departmentId === null) {
    ElMessage.warning('目标用户没有主部门，无法转交数据')
    return
  }
  if (sourceUserId.value && sourceUserId.value === target.userId) {
    ElMessage.warning('目标用户不能与待处理用户相同')
    return
  }
  if (totalSelected.value === 0) {
    ElMessage.warning('至少选择一种资源')
    return
  }

  await ElMessageBox.confirm(
    `确认向「${target.username} / ${target.departmentName || target.departmentId}」转交：` +
      `安装实例 ${selectedInstallationIds.value.size}、任务 ${selectedJobIds.value.size}、` +
      `渠道 ${selectedChannelIds.value.size}、规则 ${selectedRuleIds.value.size}？`,
    '确认数据归属转交',
    { type: 'warning', confirmButtonText: '确认整体转交', cancelButtonText: '取消' },
  )

  submitting.value = true
  try {
    transferResult.value = await transferDataOwnership({
      targetUserId: target.userId,
      pluginInstallationIds: [...selectedInstallationIds.value],
      jobIds: [...selectedJobIds.value],
      notificationChannelIds: [...selectedChannelIds.value],
      notificationRuleIds: [...selectedRuleIds.value],
    })
    clearSelections()
    resultVisible.value = true
    resourceStore.invalidateScopedData()
    await Promise.all([
      userStore.loadProfile(),
      installationTable.load(),
      jobTable.load(),
      channelTable.load(),
      ruleTable.load(),
    ])
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    searchTargetUsers(),
    installationTable.load(),
    jobTable.load(),
    channelTable.load(),
    ruleTable.load(),
  ])
})
</script>

<template>
  <PageContainer
    title="数据归属转交"
    description="事务性转交插件安装实例、任务、通知渠道和规则；关联资源不完整时后端会整体拒绝。"
  >
    <template #extra>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="totalSelected === 0"
        @click="submitTransfer"
      >
        转交已选资源（{{ totalSelected }}）
      </el-button>
    </template>

    <el-alert
      v-if="sourceUserId"
      :title="`从用户删除流程进入，待处理用户 ID：${sourceUserId}。后端未提供按所有者查询参数，请根据各表所有者列选择资源。`"
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-card shadow="never" style="margin-bottom: 16px">
      <el-form label-width="120px">
        <el-form-item label="目标用户" required>
          <el-select
            v-model="targetUserId"
            filterable
            remote
            clearable
            :loading="targetLoading"
            placeholder="搜索启用用户"
            style="width: 420px"
            @remote-method="searchTargetUsers"
          >
            <el-option
              v-for="user in targetUsers"
              :key="user.userId"
              :value="user.userId"
              :disabled="sourceUserId === user.userId || user.departmentId === null"
              :label="`${user.username} / ${user.departmentName || user.departmentId || '无主部门'}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标主部门">
          {{
            selectedTarget?.departmentName || selectedTarget?.departmentId || '选择用户后自动确定'
          }}
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs>
      <el-tab-pane :label="`安装实例（已选 ${selectedInstallationIds.size}）`">
        <PaginationTable
          :data="installationTable.items.value"
          :loading="installationTable.loading.value"
          :total="installationTable.total.value"
          :page="installationTable.page.value"
          :size="installationTable.size.value"
          @page-change="installationTable.changePage"
          @size-change="installationTable.changeSize"
        >
          <el-table-column width="52">
            <template #default="{ row }">
              <el-checkbox
                :model-value="selectedInstallationIds.has(row.installationId)"
                @change="toggleInstallation(row.installationId, Boolean($event))"
              />
            </template>
          </el-table-column>
          <el-table-column prop="installationName" label="安装名称" min-width="160" />
          <el-table-column prop="pluginId" label="Plugin ID" min-width="160" />
          <el-table-column prop="installationId" label="Installation ID" min-width="260" />
          <el-table-column label="所有者" min-width="180">
            <template #default="{ row }"><OwnerSummary v-bind="row" /></template>
          </el-table-column>
        </PaginationTable>
      </el-tab-pane>

      <el-tab-pane :label="`任务（已选 ${selectedJobIds.size}）`">
        <PaginationTable
          :data="jobTable.items.value"
          :loading="jobTable.loading.value"
          :total="jobTable.total.value"
          :page="jobTable.page.value"
          :size="jobTable.size.value"
          @page-change="jobTable.changePage"
          @size-change="jobTable.changeSize"
        >
          <el-table-column width="52"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="selectedJobIds.has(row.id)"
                @change="toggleJob(row.id, Boolean($event))" /></template
          ></el-table-column>
          <el-table-column prop="jobName" label="任务" min-width="180" />
          <el-table-column prop="pluginInstallationId" label="Installation ID" min-width="260" />
          <el-table-column label="所有者" min-width="180"
            ><template #default="{ row }"><OwnerSummary v-bind="row" /></template
          ></el-table-column>
        </PaginationTable>
      </el-tab-pane>

      <el-tab-pane :label="`通知渠道（已选 ${selectedChannelIds.size}）`">
        <PaginationTable
          :data="channelTable.items.value"
          :loading="channelTable.loading.value"
          :total="channelTable.total.value"
          :page="channelTable.page.value"
          :size="channelTable.size.value"
          @page-change="channelTable.changePage"
          @size-change="channelTable.changeSize"
        >
          <el-table-column width="52"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="selectedChannelIds.has(row.channelId)"
                @change="toggleChannel(row.channelId, Boolean($event))" /></template
          ></el-table-column>
          <el-table-column prop="displayName" label="渠道" min-width="180" />
          <el-table-column prop="channelId" label="Channel ID" min-width="180" />
          <el-table-column label="所有者" min-width="180"
            ><template #default="{ row }"><OwnerSummary v-bind="row" /></template
          ></el-table-column>
        </PaginationTable>
      </el-tab-pane>

      <el-tab-pane :label="`通知规则（已选 ${selectedRuleIds.size}）`">
        <PaginationTable
          :data="ruleTable.items.value"
          :loading="ruleTable.loading.value"
          :total="ruleTable.total.value"
          :page="ruleTable.page.value"
          :size="ruleTable.size.value"
          @page-change="ruleTable.changePage"
          @size-change="ruleTable.changeSize"
        >
          <el-table-column width="52"
            ><template #default="{ row }"
              ><el-checkbox
                :model-value="selectedRuleIds.has(row.ruleId)"
                @change="toggleRule(row.ruleId, Boolean($event))" /></template
          ></el-table-column>
          <el-table-column prop="displayName" label="规则" min-width="180" />
          <el-table-column prop="ruleId" label="Rule ID" min-width="180" />
          <el-table-column label="所有者" min-width="180"
            ><template #default="{ row }"><OwnerSummary v-bind="row" /></template
          ></el-table-column>
        </PaginationTable>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="resultVisible" title="数据转交完成" width="620px">
      <el-descriptions v-if="transferResult" :column="2" border>
        <el-descriptions-item label="目标用户">{{
          transferResult.targetUsername
        }}</el-descriptions-item>
        <el-descriptions-item label="目标部门">{{
          transferResult.targetDepartmentName
        }}</el-descriptions-item>
        <el-descriptions-item label="安装实例">{{
          transferResult.pluginInstallationsTransferred
        }}</el-descriptions-item>
        <el-descriptions-item label="任务">{{
          transferResult.jobsTransferred
        }}</el-descriptions-item>
        <el-descriptions-item label="通知渠道">{{
          transferResult.notificationChannelsTransferred
        }}</el-descriptions-item>
        <el-descriptions-item label="通知规则">{{
          transferResult.notificationRulesTransferred
        }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </PageContainer>
</template>
