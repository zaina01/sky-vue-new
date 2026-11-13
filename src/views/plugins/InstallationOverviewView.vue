<script setup lang="ts">
import OwnerSummary from '@/components/common/OwnerSummary.vue'
import PluginRuntimeDebugCard from '@/components/plugins/PluginRuntimeDebugCard.vue'
import type { PluginInstallationResponse } from '@/types/plugins'
import { formatDateTime } from '@/utils/format'

defineProps<{ installation: PluginInstallationResponse }>()
const emit = defineEmits<{ updated: [installation: PluginInstallationResponse] }>()

function stateType(state: string) {
  if (state === 'RUNNING') return 'success'
  if (state === 'STARTING') return 'warning'
  if (state === 'FAILED') return 'danger'
  return 'info'
}
</script>

<template>
  <section class="overview">
    <el-alert
      v-if="installation.state !== installation.liveState"
      title="记录状态与当前主机探测的实时状态不一致。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-descriptions :column="2" border>
      <el-descriptions-item label="安装名称">{{
        installation.installationName
      }}</el-descriptions-item>
      <el-descriptions-item label="状态"
        ><el-tag :type="stateType(installation.liveState)">{{
          installation.liveState
        }}</el-tag></el-descriptions-item
      >
      <el-descriptions-item label="Installation ID" :span="2">{{
        installation.installationId
      }}</el-descriptions-item>
      <el-descriptions-item label="Plugin ID">{{ installation.pluginId }}</el-descriptions-item>
      <el-descriptions-item label="插件名称">{{ installation.displayName }}</el-descriptions-item>
      <el-descriptions-item label="所有者/部门" :span="2"
        ><OwnerSummary v-bind="installation" compact
      /></el-descriptions-item>
      <el-descriptions-item label="Runner Instance ID">{{
        installation.instanceId || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="当前主机管理">{{
        installation.managedByCurrentHost ? '是' : '否'
      }}</el-descriptions-item>
      <el-descriptions-item label="Runner 地址">{{
        installation.runnerHost || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="Runner 端口">{{
        installation.runnerPort ?? '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="工作目录" :span="2">{{
        installation.workDir || '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="启动时间">{{
        formatDateTime(installation.startedAt)
      }}</el-descriptions-item>
      <el-descriptions-item label="更新时间">{{
        formatDateTime(installation.updatedAt)
      }}</el-descriptions-item>
      <el-descriptions-item label="插件包路径" :span="2">{{
        installation.artifactPath
      }}</el-descriptions-item>
    </el-descriptions>
    <PluginRuntimeDebugCard :runtime="installation" @saved="emit('updated', $event)" />
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: 16px;
}
</style>
