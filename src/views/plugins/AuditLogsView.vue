<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { listPluginAuditLogs } from '@/api/plugins'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginDefinitionSelect from '@/components/plugins/PluginDefinitionSelect.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type { PluginAuditLogItem, PluginAuditLogQuery } from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const resourceStore = useResourceStore()
const table = usePagination<PluginAuditLogItem, Omit<PluginAuditLogQuery, 'page' | 'size'>>(
  { installationId: '', pluginId: '', instanceId: '', actor: '', action: '' },
  (params) => listPluginAuditLogs(params),
)
const mounted = ref(false)

async function loadAuditLogs(showSuccess = false) {
  await table.load()
  if (showSuccess && (table.query.installationId || table.query.pluginId)) {
    ElMessage.success('审计日志查询成功')
  }
}

watch(
  () => table.query.pluginId,
  () => {
    if (!mounted.value) return
    table.page.value = 1
    loadAuditLogs(true)
  },
)

onMounted(() => {
  const queryInstallationId = route.query.installationId
  const queryPluginId = route.query.pluginId
  if (typeof queryInstallationId === 'string' && queryInstallationId) {
    table.query.installationId = queryInstallationId
  }
  if (typeof queryPluginId === 'string' && queryPluginId) {
    table.query.pluginId = queryPluginId
  }
  mounted.value = true
  loadAuditLogs(Boolean(table.query.installationId || table.query.pluginId))
})
watch(
  () => resourceStore.revisions.pluginAudit,
  () => {
    if (!table.loading.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="插件审计日志"
    description="按插件、实例和动作追踪配置、账号和操作审计记录。"
  >
    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="安装实例">
        <PluginInstallationSelect
          v-model="table.query.installationId"
          usage="AUDIT"
          width="270px"
        />
      </el-form-item>
      <el-form-item label="插件定义">
        <div style="width: 230px">
          <PluginDefinitionSelect v-model="table.query.pluginId" placeholder="筛选 pluginId" />
        </div>
      </el-form-item>
      <el-form-item label="Instance ID">
        <el-input v-model="table.query.instanceId" clearable />
      </el-form-item>
      <el-form-item label="操作人">
        <el-input v-model="table.query.actor" clearable />
      </el-form-item>
      <el-form-item label="Action">
        <el-input v-model="table.query.action" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadAuditLogs">查询</el-button>
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
      <el-table-column
        prop="installationId"
        label="Installation ID"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column prop="pluginId" label="Plugin ID" min-width="160" />
      <el-table-column prop="instanceId" label="Instance ID" min-width="160" />
      <el-table-column prop="action" label="动作" min-width="160" />
      <el-table-column prop="actor" label="操作人" min-width="120" />
      <el-table-column prop="detailJson" label="详情 JSON" min-width="280" show-overflow-tooltip />
      <el-table-column label="时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
    </PaginationTable>
  </PageContainer>
</template>
