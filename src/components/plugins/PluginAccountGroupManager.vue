<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onBeforeUnmount, ref, watch } from 'vue'

import {
  createPluginAccountGroup,
  deletePluginAccountGroup,
  renamePluginAccountGroup,
} from '@/api/plugins'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import { usePermissionStore } from '@/stores/permission'
import type { PluginAccountGroup } from '@/types/plugins'

const props = defineProps<{
  installationId: string
  groups: PluginAccountGroup[]
  ready: boolean
}>()
const emit = defineEmits<{ changed: [deletedGroupId?: number] }>()
const permissionStore = usePermissionStore()
const name = ref('')
const editingGroupId = ref<number>()
const busy = ref(false)
let generation = 0

function edit(group: PluginAccountGroup) {
  editingGroupId.value = group.groupId
  name.value = group.name
}

function cancelEdit() {
  editingGroupId.value = undefined
  name.value = ''
}

async function save() {
  if (busy.value || !props.ready || !permissionStore.can('plugin:account:write')) return
  const value = name.value.trim()
  if (!value || value.length > 128) {
    ElMessage.warning('分组名称去除首尾空格后须为 1–128 字符')
    return
  }
  const installationId = props.installationId
  const operationGeneration = generation
  busy.value = true
  try {
    if (editingGroupId.value === undefined) await createPluginAccountGroup(installationId, value)
    else await renamePluginAccountGroup(installationId, editingGroupId.value, value)
    if (generation !== operationGeneration) return
    cancelEdit()
    ElMessage.success('分组已保存')
    emit('changed')
  } catch {
    // Shared interceptor displays backend errors; retain the draft for correction.
  } finally {
    if (generation === operationGeneration) busy.value = false
  }
}

async function remove(group: PluginAccountGroup) {
  if (busy.value || !props.ready || !permissionStore.can('plugin:account:write')) return
  const installationId = props.installationId
  const operationGeneration = generation
  busy.value = true
  try {
    const confirmed = await ElMessageBox.confirm(
      `确认删除分组「${group.name}」（${group.accountCount} 个账户）？账户将保留并转为未分组。`,
      '删除账户分组',
      { type: 'warning', confirmButtonText: '删除分组', cancelButtonText: '取消' },
    ).then(
      () => true,
      () => false,
    )
    if (!confirmed || generation !== operationGeneration) return
    await deletePluginAccountGroup(installationId, group.groupId)
    if (generation !== operationGeneration) return
    if (editingGroupId.value === group.groupId) cancelEdit()
    ElMessage.success('分组已删除，账户已保留')
    emit('changed', group.groupId)
  } catch {
    // Shared interceptor displays request errors.
  } finally {
    if (generation === operationGeneration) busy.value = false
  }
}

watch(
  () => props.installationId,
  () => {
    generation += 1
    busy.value = false
    cancelEdit()
  },
)
onBeforeUnmount(() => {
  generation += 1
})
</script>

<template>
  <PermissionGuard permission="plugin:account:write">
    <el-form inline @submit.prevent="save">
      <el-form-item :label="editingGroupId === undefined ? '新分组' : '重命名'">
        <el-input
          v-model="name"
          maxlength="128"
          :disabled="busy || !ready"
          placeholder="分组名称"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="busy" :disabled="!ready" @click="save"
          >保存分组</el-button
        >
        <el-button v-if="editingGroupId !== undefined" :disabled="busy" @click="cancelEdit"
          >取消重命名</el-button
        >
      </el-form-item>
    </el-form>
  </PermissionGuard>
  <el-table :data="groups" border empty-text="暂无分组">
    <el-table-column prop="name" label="分组名称" min-width="180" show-overflow-tooltip />
    <el-table-column prop="accountCount" label="账户数量（含停用）" min-width="140" />
    <el-table-column label="操作" width="150">
      <template #default="{ row }">
        <PermissionGuard permission="plugin:account:write">
          <el-button link type="primary" :disabled="busy || !ready" @click="edit(row)"
            >重命名</el-button
          >
          <el-button link type="danger" :disabled="busy || !ready" @click="remove(row)"
            >删除分组</el-button
          >
        </PermissionGuard>
      </template>
    </el-table-column>
  </el-table>
</template>
