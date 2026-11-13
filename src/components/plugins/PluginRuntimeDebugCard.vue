<script setup lang="ts">
import { DocumentCopy, Edit } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormItemRule, type FormRules } from 'element-plus'
import { computed, nextTick, reactive, ref } from 'vue'

import { updatePluginInstallationDebug } from '@/api/plugins'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import type { PluginInstallationResponse, PluginRuntimeDebugRequest } from '@/types/plugins'

interface RuntimeDebugForm {
  enabled: boolean
  port?: number
  suspend: boolean
}

const props = defineProps<{
  runtime: PluginInstallationResponse
}>()

const emit = defineEmits<{
  saved: [runtime: PluginInstallationResponse]
}>()

const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<RuntimeDebugForm>({
  enabled: false,
  port: 5005,
  suspend: true,
})

const pluginName = computed(
  () => props.runtime.displayName || props.runtime.installationName || '-',
)
const formConnectionAddress = computed(() => `127.0.0.1:${form.port ?? ''}`)
const runtimeConnectionAddress = computed(
  () => `127.0.0.1:${props.runtime.remoteDebugPort ?? 5005}`,
)

function isValidPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}

const portRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    if (value === undefined || value === null || value === '') {
      callback(new Error('请输入调试端口'))
      return
    }
    if (!Number.isInteger(value)) {
      callback(new Error('调试端口必须为整数'))
      return
    }
    if (value < 1 || value > 65535) {
      callback(new Error('调试端口范围为 1～65535'))
      return
    }
    callback()
  },
  trigger: ['blur', 'change'],
}

const formRules: FormRules<RuntimeDebugForm> = {
  port: [portRule],
}

function openDialog() {
  form.enabled = props.runtime.remoteDebugEnabled ?? false
  form.port = props.runtime.remoteDebugPort ?? 5005
  form.suspend = props.runtime.remoteDebugSuspend ?? true
  dialogVisible.value = true
  void nextTick(() => formRef.value?.clearValidate())
}

function closeDialog() {
  if (!saving.value) dialogVisible.value = false
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = value
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
  ElMessage.success('监听地址已复制')
}

async function copyFormConnectionAddress() {
  if (!isValidPort(form.port)) return
  await copyText(formConnectionAddress.value)
}

async function saveDebugSettings() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !isValidPort(form.port)) return

  const payload: PluginRuntimeDebugRequest = {
    enabled: form.enabled,
    port: form.port,
    suspend: form.suspend,
  }

  saving.value = true
  try {
    const updatedRuntime = await updatePluginInstallationDebug(
      props.runtime.installationId,
      payload,
    )
    emit('saved', updatedRuntime)
    dialogVisible.value = false

    const state = updatedRuntime.liveState || updatedRuntime.state || ''
    ElMessage.success(state === 'RUNNING' ? '配置已保存，重启后生效' : '远程调试配置已保存')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-card class="runtime-debug-card" shadow="never" data-testid="runtime-debug-card">
    <template #header>
      <div class="runtime-debug-card__header">
        <div>
          <h3>远程调试</h3>
          <p>配置仅影响当前安装实例后续新启动的 runner。</p>
        </div>
        <PermissionGuard permission="plugin:runtime:manage">
          <el-button
            type="primary"
            plain
            :icon="Edit"
            data-testid="runtime-debug-edit"
            @click="openDialog"
          >
            配置
          </el-button>
        </PermissionGuard>
      </div>
    </template>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="启用状态">
        <el-tag
          :type="runtime.remoteDebugEnabled ? 'success' : 'info'"
          data-testid="runtime-debug-status"
        >
          {{ runtime.remoteDebugEnabled ? '已开启' : '已关闭' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="调试端口">
        <span data-testid="runtime-debug-port">{{ runtime.remoteDebugPort ?? 5005 }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="启动时等待">
        <span data-testid="runtime-debug-suspend">
          {{ runtime.remoteDebugSuspend ? '是' : '否' }}
        </span>
      </el-descriptions-item>
      <template v-if="runtime.remoteDebugEnabled">
        <el-descriptions-item label="Host">127.0.0.1</el-descriptions-item>
        <el-descriptions-item label="Port">{{ runtime.remoteDebugPort }}</el-descriptions-item>
        <el-descriptions-item label="IDEA 配置类型">Remote JVM Debug</el-descriptions-item>
        <el-descriptions-item label="监听地址" :span="3">
          <div class="runtime-debug-address">
            <code>{{ runtimeConnectionAddress }}</code>
            <el-tooltip content="复制监听地址" placement="top">
              <el-button
                text
                circle
                size="small"
                :icon="DocumentCopy"
                aria-label="复制监听地址"
                @click="copyText(runtimeConnectionAddress)"
              />
            </el-tooltip>
            <span>仅限运行 Host 的机器本地访问</span>
          </div>
        </el-descriptions-item>
      </template>
    </el-descriptions>

    <el-dialog
      v-model="dialogVisible"
      title="远程调试"
      width="640px"
      destroy-on-close
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-descriptions :column="1" border class="runtime-debug-plugin">
        <el-descriptions-item label="插件名称">{{ pluginName }}</el-descriptions-item>
        <el-descriptions-item label="Plugin ID">
          <code>{{ runtime.pluginId }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="Installation ID">
          <code>{{ runtime.installationId }}</code>
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        class="runtime-debug-notice"
        type="info"
        show-icon
        :closable="false"
        title="配置只对当前安装实例后续新启动的 runner 生效。已运行的服务型插件需重启；任务型插件在下一次任务执行时生效。监听地址仅限运行 Host 本机。"
      />
      <el-alert
        class="runtime-debug-notice"
        type="warning"
        show-icon
        :closable="false"
        title="启动时等待调试器会令 runner 等待 IDEA 连接，可能触发启动或任务超时；不同插件使用相同端口时，后启动的 runner 可能因端口占用失败。"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="150px"
        class="runtime-debug-form"
      >
        <el-form-item label="启用远程调试">
          <el-switch
            v-model="form.enabled"
            :disabled="saving"
            data-testid="runtime-debug-enabled-input"
          />
        </el-form-item>
        <el-form-item label="调试端口" prop="port">
          <el-input-number
            v-model="form.port"
            :step="1"
            controls-position="right"
            placeholder="1～65535"
            :disabled="!form.enabled || saving"
            data-testid="runtime-debug-port-input"
          />
        </el-form-item>
        <el-form-item label="启动时等待调试器">
          <el-switch
            v-model="form.suspend"
            :disabled="!form.enabled || saving"
            data-testid="runtime-debug-suspend-input"
          />
        </el-form-item>
        <el-form-item v-if="form.enabled" label="监听地址">
          <div class="runtime-debug-address">
            <code data-testid="runtime-debug-form-address">{{ formConnectionAddress }}</code>
            <el-tooltip content="复制监听地址" placement="top">
              <el-button
                text
                circle
                size="small"
                :icon="DocumentCopy"
                aria-label="复制监听地址"
                :disabled="!isValidPort(form.port) || saving"
                @click="copyFormConnectionAddress"
              />
            </el-tooltip>
            <span>仅限运行 Host 的机器本地访问</span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :disabled="saving" @click="closeDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="saving"
          data-testid="runtime-debug-save"
          @click="saveDebugSettings"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.runtime-debug-card {
  border-color: var(--el-border-color-lighter);
}

.runtime-debug-card__header {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.runtime-debug-card__header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.runtime-debug-card__header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.runtime-debug-plugin,
.runtime-debug-notice,
.runtime-debug-form {
  margin-bottom: 16px;
}

.runtime-debug-notice :deep(.el-alert__title) {
  line-height: 1.5;
}

.runtime-debug-address {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.runtime-debug-address code {
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}

.runtime-debug-address span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 760px) {
  .runtime-debug-card__header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
