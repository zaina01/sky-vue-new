<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  deletePluginInstallation,
  getPluginInstallation,
  restartPluginInstallation,
  startPluginInstallation,
  stopPluginInstallation,
} from '@/api/plugins'
import PageBackButton from '@/components/PageBackButton/PageBackButton.vue'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { PluginInstallationResponse } from '@/types/plugins'
import { hasAllPermissions } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const installation = ref<PluginInstallationResponse>()
const loading = ref(false)
const operating = ref(false)
let loadSequence = 0
const installationId = computed(() => String(route.params.installationId || ''))
const state = computed(() => installation.value?.liveState || installation.value?.state || '')
const canReadConfig = computed(() => userStore.permissions.includes('plugin:config:read'))
const canReadAccounts = computed(() => userStore.permissions.includes('plugin:account:read'))
const canBindNotificationChannels = computed(() =>
  hasAllPermissions(userStore.permissions, [
    'plugin:runtime:manage',
    'plugin:notification-channel:bind',
    'notification:channel:read',
  ]),
)
const activeTab = computed({
  get: () => String(route.name || '').replace('plugin-installation-', '') || 'overview',
  set: (value: string) => router.push(`/plugins/installations/${installationId.value}/${value}`),
})

async function load() {
  const currentInstallationId = installationId.value
  const sequence = ++loadSequence
  installation.value = undefined
  loading.value = true
  try {
    const response = await getPluginInstallation(currentInstallationId)
    if (sequence === loadSequence && installationId.value === currentInstallationId) {
      installation.value = response
    }
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function operate(action: 'start' | 'stop' | 'restart') {
  if (!installation.value) return
  const labels = { start: '启动', stop: '停止', restart: '重启' }
  const api = {
    start: startPluginInstallation,
    stop: stopPluginInstallation,
    restart: restartPluginInstallation,
  }[action]
  operating.value = true
  try {
    await useConfirmAction({
      title: `${labels[action]}安装实例`,
      message: `确认${labels[action]}「${installation.value.installationName}」？`,
      successMessage: `${labels[action]}请求已提交`,
      action: () => api(installationId.value),
    })
    resourceStore.invalidate('pluginInstallations')
    await load()
  } finally {
    operating.value = false
  }
}

async function remove() {
  if (!installation.value) return
  await useConfirmAction({
    title: '删除隔离实例',
    message: `确认删除「${installation.value.installationName}」？全局插件包不会被删除。`,
    successMessage: '安装实例已删除',
    action: () => deletePluginInstallation(installationId.value),
  })
  resourceStore.invalidate('pluginInstallations', 'pluginConfig', 'pluginAccounts')
  await router.replace('/plugins/installations')
}

function handleUpdated(value: PluginInstallationResponse) {
  installation.value = value
  resourceStore.invalidate('pluginInstallations')
}

watch(installationId, load)
watch(
  () => resourceStore.revisions.pluginInstallations,
  () => {
    if (!loading.value && !operating.value) void load()
  },
)
onMounted(load)
</script>

<template>
  <PageContainer
    :title="installation?.installationName || '安装实例详情'"
    :description="`隔离实例 ${installationId}`"
  >
    <template #extra>
      <PageBackButton fallback="/plugins/installations" />
      <PermissionGuard permission="plugin:runtime:manage">
        <el-button
          v-if="state !== 'RUNNING'"
          type="success"
          :loading="operating"
          @click="operate('start')"
          >启动</el-button
        >
        <el-button
          v-if="state === 'RUNNING'"
          type="warning"
          :loading="operating"
          @click="operate('stop')"
          >停止</el-button
        >
        <el-button
          v-if="state === 'RUNNING' || state === 'FAILED'"
          :loading="operating"
          @click="operate('restart')"
          >重启</el-button
        >
        <el-button type="danger" plain :loading="operating" @click="remove">删除实例</el-button>
      </PermissionGuard>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </template>

    <el-skeleton v-if="loading && !installation" animated :rows="8" />
    <template v-else-if="installation">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="运行概览" name="overview" />
        <el-tab-pane v-if="canReadConfig" label="实例配置" name="config" />
        <el-tab-pane v-if="canReadAccounts" label="实例账户" name="accounts" />
        <el-tab-pane
          v-if="canBindNotificationChannels"
          label="主动推送授权"
          name="notification-channels"
        />
      </el-tabs>
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          :key="`${installationId}:${String(route.name)}`"
          :installation="installation"
          :installation-id="installationId"
          @updated="handleUpdated"
        />
      </RouterView>
    </template>
    <el-empty v-else description="资源不存在或无权访问" />
  </PageContainer>
</template>
