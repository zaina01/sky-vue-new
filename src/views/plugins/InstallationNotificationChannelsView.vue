<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'

import { listAllChannels } from '@/api/notifications'
import {
  getPluginInstallationNotificationChannels,
  replacePluginInstallationNotificationChannels,
} from '@/api/plugins'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { NotificationChannelItem } from '@/types/notifications'
import type { PluginInstallationResponse } from '@/types/plugins'
import {
  buildNotificationChannelMap,
  buildNotificationChannelNameCounts,
  formatNotificationChannelOptionLabel,
  formatNotificationChannelTooltip,
  resolveNotificationChannelName,
} from '@/utils/notificationChannel'
import { hasAllPermissions } from '@/utils/permission'

type PoolStatus = 'unknown' | 'loading' | 'known' | 'error'

const props = defineProps<{ installation: PluginInstallationResponse }>()
const userStore = useUserStore()
const resourceStore = useResourceStore()
const poolStatus = ref<PoolStatus>('unknown')
const boundChannelIds = ref<string[]>()
const draftChannelIds = ref<string[]>()
const channels = ref<NotificationChannelItem[]>([])
const channelOptionsLoading = ref(false)
const editVisible = ref(false)
const draftTouched = ref(false)
const saving = ref(false)
let poolLoadSequence = 0
let channelLoadSequence = 0

const requiredPermissions = [
  'plugin:runtime:manage',
  'plugin:notification-channel:bind',
  'notification:channel:read',
]
const canManagePool = computed(() => hasAllPermissions(userStore.permissions, requiredPermissions))
const canEdit = computed(
  () => canManagePool.value && poolStatus.value === 'known' && Array.isArray(boundChannelIds.value),
)
const channelMap = computed(() => buildNotificationChannelMap(channels.value))
const channelNameCounts = computed(() => buildNotificationChannelNameCounts(channels.value))
const channelOptions = computed(() => {
  const options = new Map(channels.value.map((channel) => [channel.channelId, channel]))
  for (const channelId of boundChannelIds.value || []) {
    if (!options.has(channelId)) {
      options.set(channelId, {
        channelId,
        displayName: channelId,
        channelType: 'WEBHOOK',
        enabled: false,
        ownerUserId: '',
        ownerUsername: '',
        ownerDepartmentId: null,
        ownerDepartmentName: null,
      })
    }
  }
  return [...options.values()]
})

function boundChannelName(channelId: string) {
  return resolveNotificationChannelName(channelId, channelMap.value)
}

function boundChannelTooltip(channelId: string) {
  return formatNotificationChannelTooltip(channelId, channelMap.value)
}

function channelOptionLabel(channel: NotificationChannelItem) {
  const label = formatNotificationChannelOptionLabel(
    channel.channelId,
    channelMap.value,
    channelNameCounts.value,
  )
  if (!channelMap.value.has(channel.channelId)) return `${label}（不可读）`
  return channel.enabled ? label : `${label}（已停用）`
}

function isChannelIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

async function loadChannelDirectory() {
  const sequence = ++channelLoadSequence
  channelOptionsLoading.value = true
  try {
    const result = await listAllChannels()
    if (sequence === channelLoadSequence && canManagePool.value) channels.value = result
  } catch {
    if (sequence === channelLoadSequence) channels.value = []
    // 名称目录只是展示增强；失败时清除旧名称并回退渠道 ID。
  } finally {
    if (sequence === channelLoadSequence) channelOptionsLoading.value = false
  }
}

async function loadPool() {
  const sequence = ++poolLoadSequence
  editVisible.value = false
  draftTouched.value = false
  boundChannelIds.value = undefined
  draftChannelIds.value = undefined
  poolStatus.value = 'unknown'
  if (!canManagePool.value) return

  poolStatus.value = 'loading'
  try {
    const response = await getPluginInstallationNotificationChannels(
      props.installation.installationId,
    )
    if (sequence !== poolLoadSequence) return
    if (!isChannelIdList(response)) {
      poolStatus.value = 'error'
      ElMessage.error('实例渠道池响应格式无效，编辑入口保持禁用')
      return
    }
    boundChannelIds.value = [...new Set(response)]
    draftChannelIds.value = [...boundChannelIds.value]
    poolStatus.value = 'known'
  } catch {
    if (sequence === poolLoadSequence) poolStatus.value = 'error'
  }
}

function reload() {
  void Promise.allSettled([loadPool(), loadChannelDirectory()])
}

function openEdit() {
  if (!canEdit.value || !boundChannelIds.value) return
  draftChannelIds.value = [...boundChannelIds.value]
  draftTouched.value = false
  editVisible.value = true
}

function updateDraft(value: string[]) {
  if (poolStatus.value !== 'known') return
  draftChannelIds.value = [...value]
  draftTouched.value = true
}

async function savePool() {
  if (
    !canEdit.value ||
    !draftTouched.value ||
    !Array.isArray(boundChannelIds.value) ||
    !Array.isArray(draftChannelIds.value)
  ) {
    return
  }

  if (boundChannelIds.value.length > 0 && draftChannelIds.value.length === 0) {
    await ElMessageBox.confirm(
      `确认清空实例「${props.installation.installationName}」的全部主动推送渠道？`,
      '清空实例渠道池',
      { type: 'warning', confirmButtonText: '确认清空', cancelButtonText: '取消' },
    )
  }

  saving.value = true
  try {
    const response = await replacePluginInstallationNotificationChannels(
      props.installation.installationId,
      [...draftChannelIds.value],
    )
    if (!isChannelIdList(response)) {
      poolStatus.value = 'error'
      boundChannelIds.value = undefined
      draftChannelIds.value = undefined
      editVisible.value = false
      ElMessage.error('实例渠道池更新响应格式无效，请重新读取后再编辑')
      return
    }
    boundChannelIds.value = [...new Set(response)]
    draftChannelIds.value = [...boundChannelIds.value]
    draftTouched.value = false
    editVisible.value = false
    resourceStore.invalidate('pluginInstallations', 'jobs')
    ElMessage.success('实例渠道池已更新')
  } finally {
    saving.value = false
  }
}

watch(
  [() => props.installation.installationId, canManagePool],
  ([, allowed]) => {
    void loadPool()
    if (allowed) void loadChannelDirectory()
    else {
      channelLoadSequence += 1
      channels.value = []
      channelOptionsLoading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => resourceStore.revisions.notificationChannels,
  () => {
    if (canManagePool.value) void loadChannelDirectory()
  },
)
</script>

<template>
  <section>
    <el-alert
      v-if="!canManagePool"
      title="缺少实例管理、实例渠道绑定或通知渠道读取权限，不能读取或编辑实例渠道池。"
      type="warning"
      show-icon
      :closable="false"
    />
    <el-alert
      v-else-if="poolStatus === 'loading'"
      title="正在读取实例渠道池；读取成功前不会开放编辑或提交。"
      type="info"
      show-icon
      :closable="false"
    />
    <el-alert
      v-else-if="poolStatus === 'error'"
      title="实例渠道池读取失败，当前绑定保持未知状态；编辑和提交均已禁用。"
      type="error"
      show-icon
      :closable="false"
    />
    <el-alert
      v-else-if="poolStatus === 'known'"
      title="实例渠道池已成功读取；名称目录不可用时会回退显示渠道 ID。"
      type="success"
      show-icon
      :closable="false"
    />

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <div class="pool-header">
          <strong>插件主动推送授权</strong>
          <el-button
            v-if="canManagePool"
            :loading="poolStatus === 'loading' || channelOptionsLoading"
            @click="reload"
          >
            重新读取
          </el-button>
        </div>
      </template>
      <p>
        实例渠道池是该安装实例可主动推送的最大渠道集合；任务渠道只能是它的子集，与宿主通知规则互相独立。
      </p>
      <div v-if="poolStatus === 'known'" class="bound-channels">
        <span>当前绑定：</span>
        <span v-if="!boundChannelIds?.length">无</span>
        <el-tooltip
          v-for="channelId in boundChannelIds"
          :key="channelId"
          :content="boundChannelTooltip(channelId)"
          placement="top"
        >
          <el-tag>{{ boundChannelName(channelId) }}</el-tag>
        </el-tooltip>
      </div>
      <PermissionGuard :permissions="requiredPermissions" mode="all">
        <el-button type="primary" :disabled="!canEdit" @click="openEdit">
          编辑实例渠道池
        </el-button>
      </PermissionGuard>
    </el-card>

    <el-dialog v-model="editVisible" title="编辑实例渠道池" width="680px" destroy-on-close>
      <el-alert
        title="可提交空数组，但必须由用户明确清空；读取失败或未知状态永远不会提交。"
        type="info"
        :closable="false"
        style="margin-bottom: 14px"
      />
      <el-form label-width="110px">
        <el-form-item label="通知渠道">
          <el-select
            :model-value="draftChannelIds"
            multiple
            filterable
            style="width: 100%"
            placeholder="选择当前实例允许主动推送的渠道"
            @update:model-value="updateDraft"
          >
            <el-option
              v-for="channel in channelOptions"
              :key="channel.channelId"
              :value="channel.channelId"
              :label="channelOptionLabel(channel)"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="editVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!canEdit || !draftTouched"
          @click="savePool"
        >
          保存渠道池
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.pool-header,
.bound-channels {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pool-header {
  justify-content: space-between;
}

.bound-channels {
  flex-wrap: wrap;
  margin: 14px 0;
}
</style>
