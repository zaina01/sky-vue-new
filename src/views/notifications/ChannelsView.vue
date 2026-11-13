<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  setChannelEnabled,
  testChannel,
  updateChannel,
} from '@/api/notifications'
import JsonEditor from '@/components/JsonEditor/JsonEditor.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import type { ID } from '@/types/common'
import type {
  NotificationChannelCreatePayload,
  NotificationChannelItem,
  NotificationChannelPayload,
  NotificationChannelType,
  NotificationChannelUpdatePayload,
} from '@/types/notifications'
import { isMaskedSecret, stripUnchangedMaskedSecrets } from '@/utils/maskedConfig'

const resourceStore = useResourceStore()

interface WebhookConfig {
  url: string
  method: 'POST' | 'PUT'
  headersText: string
  timeoutMillis?: number
}

interface PushPlusConfig {
  token: string
  topic?: string
  template?: string
  channel?: string
}

const table = usePagination<NotificationChannelItem, Record<string, never>>({}, (params) =>
  listChannels(params),
)
const channelDialogVisible = ref(false)
const channelDialogMode = ref<'create' | 'edit'>('create')
const channelLoading = ref(false)
const channelSaving = ref(false)
const configJsonValid = ref(true)
const advancedMode = ref(false)
const editingChannelId = ref<ID>()
const channelFormRef = ref<FormInstance>()
const channelForm = reactive<NotificationChannelPayload>({
  channelId: '',
  displayName: '',
  channelType: 'WEBHOOK',
  enabled: true,
  configJson: '{}',
  remark: '',
})
const originalMaskedConfigJson = ref('{}')
const editingOwner = ref<NotificationChannelItem>()
const webhookConfig = reactive<WebhookConfig>({
  url: '',
  method: 'POST',
  headersText: '{}',
  timeoutMillis: 10000,
})
const pushPlusConfig = reactive<PushPlusConfig>({ token: '', topic: '', template: '', channel: '' })

const channelDialogTitle = computed(() =>
  channelDialogMode.value === 'create' ? '创建渠道' : '编辑渠道',
)
const channelRules: FormRules<NotificationChannelPayload> = {
  channelId: [{ required: true, message: '请输入渠道 ID', trigger: 'blur' }],
  channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
}

function resetChannelForm() {
  editingChannelId.value = undefined
  editingOwner.value = undefined
  originalMaskedConfigJson.value = '{}'
  advancedMode.value = false
  configJsonValid.value = true
  Object.assign(channelForm, {
    channelId: '',
    displayName: '',
    channelType: 'WEBHOOK' as NotificationChannelType,
    enabled: true,
    configJson: '{}',
    remark: '',
  })
  Object.assign(webhookConfig, { url: '', method: 'POST', headersText: '{}', timeoutMillis: 10000 })
  Object.assign(pushPlusConfig, { token: '', topic: '', template: '', channel: '' })
  channelFormRef.value?.clearValidate()
}

function openCreateDialog() {
  channelDialogMode.value = 'create'
  resetChannelForm()
  channelDialogVisible.value = true
}

function syncConfigFromForm() {
  if (advancedMode.value) return true
  try {
    if (channelForm.channelType === 'WEBHOOK') {
      channelForm.configJson = JSON.stringify(
        {
          url: webhookConfig.url,
          method: webhookConfig.method,
          headers: JSON.parse(webhookConfig.headersText || '{}') as Record<string, string>,
          timeoutMillis: webhookConfig.timeoutMillis,
        },
        null,
        2,
      )
    } else {
      channelForm.configJson = JSON.stringify(
        {
          token: pushPlusConfig.token,
          topic: pushPlusConfig.topic || undefined,
          template: pushPlusConfig.template || undefined,
          channel: pushPlusConfig.channel || undefined,
        },
        null,
        2,
      )
    }
    configJsonValid.value = true
    return true
  } catch {
    configJsonValid.value = false
    ElMessage.error('Headers 必须是合法 JSON 对象')
    return false
  }
}

function hydrateSimpleConfig(configJson?: string) {
  if (!configJson) return
  channelForm.configJson = configJson
  try {
    const config = JSON.parse(configJson) as Record<string, unknown>
    if (channelForm.channelType === 'WEBHOOK') {
      webhookConfig.url = String(config.url || '')
      webhookConfig.method = config.method === 'PUT' ? 'PUT' : 'POST'
      webhookConfig.headersText = JSON.stringify(config.headers || {}, null, 2)
      webhookConfig.timeoutMillis = Number(config.timeoutMillis || 10000)
    } else {
      pushPlusConfig.token = isMaskedSecret(config.token) ? '' : String(config.token || '')
      pushPlusConfig.topic = String(config.topic || '')
      pushPlusConfig.template = String(config.template || '')
      pushPlusConfig.channel = String(config.channel || '')
    }
  } catch {
    advancedMode.value = true
  }
}

async function openEditDialog(row: NotificationChannelItem) {
  channelDialogMode.value = 'edit'
  resetChannelForm()
  channelDialogVisible.value = true
  channelLoading.value = true
  try {
    const detail = await getChannel(row.channelId)
    editingChannelId.value = detail.channelId
    editingOwner.value = detail
    originalMaskedConfigJson.value = detail.configMaskedJson || '{}'
    Object.assign(channelForm, {
      channelId: String(detail.channelId),
      displayName: detail.displayName,
      channelType: detail.channelType,
      enabled: detail.enabled,
      configJson: detail.configMaskedJson || '{}',
      remark: detail.remark || '',
    })
    hydrateSimpleConfig(detail.configMaskedJson)
  } finally {
    channelLoading.value = false
  }
}

function buildCreatePayload(): NotificationChannelCreatePayload {
  return {
    channelId: channelForm.channelId,
    displayName: channelForm.displayName,
    channelType: channelForm.channelType,
    enabled: channelForm.enabled,
    configJson: channelForm.configJson,
    remark: channelForm.remark,
  }
}

function buildUpdatePayload(): NotificationChannelUpdatePayload {
  return {
    displayName: channelForm.displayName,
    channelType: channelForm.channelType,
    enabled: channelForm.enabled,
    configJson: stripUnchangedMaskedSecrets(originalMaskedConfigJson.value, channelForm.configJson),
    remark: channelForm.remark,
  }
}

async function saveChannel() {
  const valid = await channelFormRef.value?.validate().catch(() => false)
  if (!valid || !syncConfigFromForm() || !configJsonValid.value) return
  channelSaving.value = true
  try {
    if (channelDialogMode.value === 'create') {
      await createChannel(buildCreatePayload())
      ElMessage.success('渠道已创建')
    } else if (editingChannelId.value !== undefined) {
      await updateChannel(editingChannelId.value, buildUpdatePayload())
      ElMessage.success('渠道已更新')
    }
    channelDialogVisible.value = false
    resourceStore.invalidate('notificationChannels')
    await table.load()
  } finally {
    channelSaving.value = false
  }
}

async function toggle(row: NotificationChannelItem) {
  await useConfirmAction({
    title: row.enabled ? '禁用渠道' : '启用渠道',
    message: `确认${row.enabled ? '禁用' : '启用'}通知渠道「${row.displayName}」？`,
    successMessage: '渠道状态已更新',
    action: () => setChannelEnabled(row.channelId, !row.enabled),
  })
  resourceStore.invalidate('notificationChannels')
  await table.load()
}

async function remove(row: NotificationChannelItem) {
  await useConfirmAction({
    title: '删除渠道',
    message: `确认删除通知渠道「${row.displayName}」？`,
    successMessage: '渠道已删除',
    action: () => deleteChannel(row.channelId),
  })
  resourceStore.invalidate('notificationChannels', 'notificationRules')
  await table.load()
}

async function test(row: NotificationChannelItem) {
  await useConfirmAction({
    title: '测试发送',
    message: `确认向渠道「${row.displayName}」发送测试通知？`,
    successMessage: '测试通知已提交，可在发送历史查看结果',
    action: () =>
      testChannel(row.channelId, {
        title: 'Sky New 测试通知',
        content: '这是一条由管理后台发起的测试通知。',
        severity: 'INFO',
      }),
  })
  resourceStore.invalidate('notificationHistory')
}

onMounted(table.load)
watch(
  () => resourceStore.revisions.notificationChannels,
  () => {
    if (!table.loading.value && !channelSaving.value) void table.load()
  },
)
</script>

<template>
  <PageContainer
    title="通知渠道"
    description="管理 WEBHOOK、PUSHPLUS 等通知出口，敏感配置需重新填写。"
  >
    <template #extra>
      <PermissionGuard permission="notification:channel:write">
        <el-button type="primary" @click="openCreateDialog">创建渠道</el-button>
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
      <el-table-column prop="displayName" label="渠道名称" min-width="180" />
      <el-table-column prop="channelType" label="类型" width="130" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{
            row.enabled ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="220" />
      <el-table-column label="所有者/部门" min-width="190">
        <template #default="{ row }"><OwnerSummary v-bind="row" /></template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="notification:channel:write">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="warning" @click="toggle(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button>
          </PermissionGuard>
          <PermissionGuard permission="notification:channel:test">
            <el-button link type="success" @click="test(row)">测试</el-button>
          </PermissionGuard>
          <PermissionGuard permission="notification:channel:write">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog
      v-model="channelDialogVisible"
      :title="channelDialogTitle"
      width="760px"
      destroy-on-close
    >
      <el-skeleton v-if="channelLoading" animated :rows="8" />
      <el-form
        v-else
        ref="channelFormRef"
        :model="channelForm"
        :rules="channelRules"
        label-width="120px"
      >
        <el-alert
          v-if="channelDialogMode === 'edit'"
          title="敏感配置只返回掩码；留空或保持全星号表示不修改，前端不会把掩码当成新密钥提交。"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 14px"
        />
        <el-descriptions v-if="editingOwner" :column="1" border style="margin-bottom: 14px">
          <el-descriptions-item label="所有者/部门"
            ><OwnerSummary v-bind="editingOwner" compact
          /></el-descriptions-item>
        </el-descriptions>
        <el-form-item label="渠道 ID" prop="channelId">
          <el-input v-model="channelForm.channelId" :disabled="channelDialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="渠道名称" prop="displayName">
          <el-input v-model="channelForm.displayName" />
        </el-form-item>
        <el-form-item label="渠道类型" prop="channelType">
          <el-select v-model="channelForm.channelType" style="width: 180px">
            <el-option label="WEBHOOK" value="WEBHOOK" />
            <el-option label="PUSHPLUS" value="PUSHPLUS" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="channelForm.enabled" />
        </el-form-item>
        <el-form-item label="高级 JSON">
          <el-switch v-model="advancedMode" />
        </el-form-item>

        <template v-if="!advancedMode && channelForm.channelType === 'WEBHOOK'">
          <el-form-item label="URL" required>
            <el-input v-model="webhookConfig.url" placeholder="https://example.com/webhook" />
          </el-form-item>
          <el-form-item label="Method">
            <el-radio-group v-model="webhookConfig.method">
              <el-radio-button label="POST" />
              <el-radio-button label="PUT" />
            </el-radio-group>
          </el-form-item>
          <el-form-item label="Headers JSON">
            <JsonEditor
              v-model="webhookConfig.headersText"
              :rows="5"
              @valid-change="configJsonValid = $event"
            />
          </el-form-item>
          <el-form-item label="Timeout(ms)">
            <el-input-number v-model="webhookConfig.timeoutMillis" :min="1000" />
          </el-form-item>
        </template>

        <template v-if="!advancedMode && channelForm.channelType === 'PUSHPLUS'">
          <el-form-item label="Token" required>
            <el-input v-model="pushPlusConfig.token" type="password" show-password />
          </el-form-item>
          <el-form-item label="Topic">
            <el-input v-model="pushPlusConfig.topic" />
          </el-form-item>
          <el-form-item label="Template">
            <el-input v-model="pushPlusConfig.template" />
          </el-form-item>
          <el-form-item label="Channel">
            <el-input v-model="pushPlusConfig.channel" />
          </el-form-item>
        </template>

        <el-form-item v-if="advancedMode" label="Config JSON">
          <JsonEditor
            v-model="channelForm.configJson"
            style="width: 100%"
            @valid-change="configJsonValid = $event"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="channelForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="channelSaving"
          :disabled="channelLoading || !configJsonValid"
          @click="saveChannel"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>
