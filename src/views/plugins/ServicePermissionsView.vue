<script setup lang="ts">
import { ElMessage, type FormInstance, type FormItemRule, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  deletePluginServicePermission,
  getPluginServicePermission,
  listPluginServicePermissions,
  savePluginServicePermissionsBatch,
  setPluginServicePermissionEnabled,
} from '@/api/plugins'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginDefinitionSelect from '@/components/plugins/PluginDefinitionSelect.vue'
import PluginInstallationSelect from '@/components/plugins/PluginInstallationSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { PluginServicePermissionItem, PluginServicePermissionQuery } from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

const operationPattern = /^[A-Za-z0-9._-]{1,128}$/
const resourceStore = useResourceStore()
const userStore = useUserStore()
const createPermissions = ['plugin:service-permission:write', 'plugin:runtime:read']
const canReadInstallations = computed(() => userStore.permissions.includes('plugin:runtime:read'))
const table = usePagination<
  PluginServicePermissionItem,
  Omit<PluginServicePermissionQuery, 'page' | 'size'>
>(
  {
    callerInstallationId: '',
    callerPluginId: '',
    targetInstallationId: '',
    targetPluginId: '',
    operation: '',
    enabled: '',
  },
  (params) => listPluginServicePermissions(params),
)

const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<PluginServicePermissionItem>()
const form = reactive({
  callerInstallationId: '',
  targetInstallationId: '',
  operationsText: '',
  enabled: true,
})

function parseOperations(value: string) {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((operation) => operation.trim())
        .filter(Boolean),
    ),
  ]
}

const operations = computed(() => parseOperations(form.operationsText))
const operationRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    const parsed = parseOperations(String(value || ''))
    if (!parsed.length) {
      callback(new Error('请至少输入一个 Operation，每行一个方法'))
      return
    }
    if (parsed.length > 100) {
      callback(new Error('每次最多保存 100 个不同的 Operation'))
      return
    }
    const invalid = parsed.find((operation) => !operationPattern.test(operation))
    if (invalid !== undefined) {
      callback(
        new Error(
          `Operation「${invalid}」无效：只能包含字母、数字、点、下划线和中划线，长度 1-128`,
        ),
      )
      return
    }
    callback()
  },
  trigger: ['blur', 'change'],
}

const rules: FormRules<typeof form> = {
  callerInstallationId: [{ required: true, message: '请选择调用方安装实例', trigger: 'change' }],
  targetInstallationId: [{ required: true, message: '请选择目标方安装实例', trigger: 'change' }],
  operationsText: [operationRule],
}

const relationPreview = computed(() => {
  if (!form.callerInstallationId || !form.targetInstallationId) return ''
  return `${form.callerInstallationId} → ${form.targetInstallationId}`
})

function search() {
  table.page.value = 1
  return table.load()
}

function openCreateDialog() {
  Object.assign(form, {
    callerInstallationId: '',
    targetInstallationId: '',
    operationsText: '',
    enabled: true,
  })
  formRef.value?.clearValidate()
  dialogVisible.value = true
}

function permissionTitle(row: PluginServicePermissionItem) {
  return `${row.callerInstallationId} -> ${row.targetInstallationId}:${row.operation}`
}

async function openDetail(row: PluginServicePermissionItem) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = undefined
  try {
    detail.value = await getPluginServicePermission(row.id)
  } finally {
    detailLoading.value = false
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    const saved = await savePluginServicePermissionsBatch({
      callerInstallationId: form.callerInstallationId,
      targetInstallationId: form.targetInstallationId,
      operations: operations.value,
      enabled: form.enabled,
    })
    ElMessage.success(`已保存 ${saved.length} 项安装实例服务调用权限`)
    dialogVisible.value = false
    resourceStore.invalidate('pluginService')
    await table.load()
  } catch {
    // The shared request handler displays API errors; keep the form for retry.
  } finally {
    saving.value = false
  }
}

async function toggle(row: PluginServicePermissionItem) {
  let updated: PluginServicePermissionItem | undefined
  await useConfirmAction({
    title: row.enabled ? '禁用调用权限' : '启用调用权限',
    message: `确认${row.enabled ? '禁用' : '启用'}「${permissionTitle(row)}」？`,
    successMessage: '调用权限状态已更新',
    action: async () => {
      updated = await setPluginServicePermissionEnabled(row.id, !row.enabled)
      row.enabled = updated.enabled
      if (detail.value?.id === updated.id) detail.value = updated
    },
  })
  resourceStore.invalidate('pluginService')
  await table.load()
}

async function remove(row: PluginServicePermissionItem) {
  await useConfirmAction({
    title: '删除服务调用权限',
    message: `确认删除「${permissionTitle(row)}」？`,
    successMessage: '服务调用权限已删除',
    action: () => deletePluginServicePermission(row.id),
  })
  resourceStore.invalidate('pluginService')
  if (table.page.value > 1 && table.items.value.length === 1) table.page.value -= 1
  if (detail.value?.id === row.id) {
    detailVisible.value = false
    detail.value = undefined
  }
  await table.load()
}

watch(
  () => resourceStore.revisions.pluginService,
  (value, previous) => {
    if (value !== previous && !table.loading.value && !saving.value) void table.load()
  },
)
onMounted(table.load)
</script>

<template>
  <PageContainer
    title="插件服务权限"
    description="调用方和目标方均按 installationId 授权；列表及总数直接采用后端分页结果。"
  >
    <template #extra>
      <PermissionGuard :permissions="createPermissions" mode="all">
        <el-button type="primary" @click="openCreateDialog">新增实例调用权限</el-button>
      </PermissionGuard>
      <el-button :loading="table.loading.value" @click="table.load">刷新</el-button>
    </template>

    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="调用方实例">
        <PluginInstallationSelect
          v-if="canReadInstallations"
          v-model="table.query.callerInstallationId"
          usage="RUNTIME"
          placeholder="调用方 installationId"
          width="260px"
        />
        <el-input
          v-else
          v-model="table.query.callerInstallationId"
          clearable
          placeholder="输入调用方 installationId"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="调用方定义">
        <div class="definition-filter">
          <PluginDefinitionSelect
            v-if="canReadInstallations"
            v-model="table.query.callerPluginId"
            placeholder="调用方 pluginId"
          />
          <el-input
            v-else
            v-model="table.query.callerPluginId"
            clearable
            placeholder="输入调用方 pluginId"
          />
        </div>
      </el-form-item>
      <el-form-item label="目标方实例">
        <PluginInstallationSelect
          v-if="canReadInstallations"
          v-model="table.query.targetInstallationId"
          usage="SERVICE"
          placeholder="目标方 installationId"
          width="260px"
        />
        <el-input
          v-else
          v-model="table.query.targetInstallationId"
          clearable
          placeholder="输入目标方 installationId"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="目标方定义">
        <div class="definition-filter">
          <PluginDefinitionSelect
            v-if="canReadInstallations"
            v-model="table.query.targetPluginId"
            placeholder="目标方 pluginId"
          />
          <el-input
            v-else
            v-model="table.query.targetPluginId"
            clearable
            placeholder="输入目标方 pluginId"
          />
        </div>
      </el-form-item>
      <el-form-item label="Operation">
        <el-input v-model="table.query.operation" clearable style="width: 180px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="table.query.enabled" clearable placeholder="全部" style="width: 120px">
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
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
      row-key="id"
      @page-change="table.changePage"
      @size-change="table.changeSize"
    >
      <el-table-column
        prop="callerInstallationId"
        label="调用方 Installation ID"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column
        prop="callerPluginId"
        label="调用方 Plugin ID"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column
        prop="targetInstallationId"
        label="目标方 Installation ID"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column
        prop="targetPluginId"
        label="目标方 Plugin ID"
        min-width="170"
        show-overflow-tooltip
      />
      <el-table-column prop="operation" label="Operation" min-width="170" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{
            row.enabled ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <PermissionGuard permission="plugin:service-permission:write">
            <el-button link type="primary" @click="toggle(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog
      v-model="dialogVisible"
      title="新增实例服务调用权限"
      width="720px"
      destroy-on-close
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="saving" label-width="130px">
        <el-form-item label="调用方实例" prop="callerInstallationId">
          <PluginInstallationSelect
            v-model="form.callerInstallationId"
            usage="RUNTIME"
            :clearable="false"
            :disabled="saving"
            width="100%"
          />
        </el-form-item>
        <el-form-item label="目标方实例" prop="targetInstallationId">
          <PluginInstallationSelect
            v-model="form.targetInstallationId"
            usage="SERVICE"
            :clearable="false"
            :disabled="saving"
            width="100%"
          />
        </el-form-item>
        <el-alert
          title="目标方只列出声明 SERVICE 能力的实例；普通 TASK 实例不支持服务调用，不能作为目标。"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />
        <el-form-item label="Operation" prop="operationsText">
          <el-input
            v-model="form.operationsText"
            type="textarea"
            :rows="6"
            placeholder="每行一个方法，支持粘贴多行；最多 100 个方法"
          />
          <div aria-live="polite">待保存 {{ operations.length }} 项权限（已忽略空行并去重）</div>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        <el-alert v-if="relationPreview" :title="relationPreview" type="info" :closable="false" />
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="saving" @click="save">
          保存 {{ operations.length }} 项权限
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="服务调用权限详情" width="760px" destroy-on-close>
      <el-skeleton v-if="detailLoading" animated :rows="7" />
      <el-descriptions v-else-if="detail" :column="1" border>
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="调用方 Installation ID">
          {{ detail.callerInstallationId }}
        </el-descriptions-item>
        <el-descriptions-item label="调用方 Plugin ID">
          {{ detail.callerPluginId }}
        </el-descriptions-item>
        <el-descriptions-item label="目标方 Installation ID">
          {{ detail.targetInstallationId }}
        </el-descriptions-item>
        <el-descriptions-item label="目标方 Plugin ID">
          {{ detail.targetPluginId }}
        </el-descriptions-item>
        <el-descriptions-item label="Operation">{{ detail.operation }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detail.enabled ? 'success' : 'info'">
            {{ detail.enabled ? '启用' : '禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDateTime(detail.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ formatDateTime(detail.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.definition-filter {
  width: 230px;
}
</style>
