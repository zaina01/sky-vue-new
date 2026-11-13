/* eslint-disable vue/one-component-per-file */
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElInputNumber, ElMessage, ElSwitch } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { restartPluginInstallation, updatePluginInstallationDebug } from '@/api/plugins'
import PluginRuntimeDebugCard from '@/components/plugins/PluginRuntimeDebugCard.vue'
import { useUserStore } from '@/stores/user'
import type { PluginInstallationResponse } from '@/types/plugins'

vi.mock('@/api/plugins', () => ({
  restartPluginInstallation: vi.fn(),
  updatePluginInstallationDebug: vi.fn(),
}))

const updatePluginInstallationDebugMock = vi.mocked(updatePluginInstallationDebug)
const restartPluginInstallationMock = vi.mocked(restartPluginInstallation)

const DialogStub = defineComponent({
  name: 'ElDialog',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
  },
  template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
})

function createRuntime(
  overrides: Partial<PluginInstallationResponse> = {},
): PluginInstallationResponse {
  return {
    id: 1,
    installationId: 'installation-uuid-1',
    pluginId: 'demo.plugin',
    instanceId: 'runtime-1',
    installationName: '示例隔离实例',
    version: '1.0.0',
    displayName: '示例插件',
    mainClass: 'com.example.Plugin',
    artifactPath: '/plugins/demo.jar',
    artifactSha256: 'sha256',
    runtimeType: 'JAR',
    state: 'STOPPED',
    runnerHost: null,
    runnerPort: null,
    workDir: null,
    capabilitiesJson: '{}',
    configSchemaJson: '{}',
    accountSchemaJson: '{}',
    liveState: 'STOPPED',
    remoteDebugEnabled: true,
    remoteDebugPort: 6100,
    remoteDebugSuspend: false,
    managedByCurrentHost: true,
    ownerUserId: 'user-1',
    ownerUsername: 'tester',
    ownerDepartmentId: 1,
    ownerDepartmentName: '研发部',
    startedAt: null,
    createdAt: '2026-08-02T00:00:00',
    updatedAt: '2026-08-02T00:00:00',
    ...overrides,
  }
}

function createTestPinia(permissions: string[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile({
    userId: 'user-1',
    username: 'tester',
    email: 'tester@example.com',
    registerTime: '2026-07-31T00:00:00Z',
    roles: [],
    permissions,
    departmentId: 1,
    departmentName: '研发部',
  })
  return pinia
}

function mountCard(
  runtime = createRuntime(),
  permissions = ['plugin:runtime:read', 'plugin:runtime:manage'],
) {
  const pinia = createTestPinia(permissions)
  return mount(PluginRuntimeDebugCard, {
    props: { runtime },
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        ElDialog: DialogStub,
        teleport: true,
        transition: false,
      },
    },
  })
}

function mountCardHarness(initialRuntime = createRuntime()) {
  const pinia = createTestPinia(['plugin:runtime:read', 'plugin:runtime:manage'])
  const Harness = defineComponent({
    components: { PluginRuntimeDebugCard },
    setup() {
      const runtime = ref(initialRuntime)
      return { runtime }
    },
    template: '<PluginRuntimeDebugCard :runtime="runtime" @saved="runtime = $event" />',
  })

  return mount(Harness, {
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        ElDialog: DialogStub,
        teleport: true,
        transition: false,
      },
    },
  })
}

async function openDialog(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="runtime-debug-edit"]').trigger('click')
  await vi.waitFor(() => {
    expect(wrapper.find('[data-testid="runtime-debug-save"]').exists()).toBe(true)
  })
}

async function save(wrapper: VueWrapper) {
  await wrapper.get('[data-testid="runtime-debug-save"]').trigger('click')
  await flushPromises()
}

describe('PluginRuntimeDebugCard', () => {
  beforeEach(() => {
    updatePluginInstallationDebugMock.mockReset()
    restartPluginInstallationMock.mockReset()
  })

  it('reads and fills all remote debug fields from the runtime response', async () => {
    const wrapper = mountCard(
      createRuntime({
        remoteDebugEnabled: true,
        remoteDebugPort: 6200,
        remoteDebugSuspend: false,
      }),
    )

    await openDialog(wrapper)

    const switches = wrapper.findAllComponents(ElSwitch)
    expect(switches).toHaveLength(2)
    expect(switches[0].props('modelValue')).toBe(true)
    expect(wrapper.getComponent(ElInputNumber).props('modelValue')).toBe(6200)
    expect(switches[1].props('modelValue')).toBe(false)
  })

  it.each([
    ['less than one', 0],
    ['greater than 65535', 65536],
    ['not an integer', 5005.5],
    ['empty', undefined],
  ])('does not submit when the port is %s', async (_label, port) => {
    const wrapper = mountCard()
    await openDialog(wrapper)

    wrapper.getComponent(ElInputNumber).vm.$emit('update:modelValue', port)
    await nextTick()
    await save(wrapper)

    expect(updatePluginInstallationDebugMock).not.toHaveBeenCalled()
  })

  it('submits suspend=false instead of omitting it', async () => {
    const runtime = createRuntime({ remoteDebugSuspend: true })
    const updatedRuntime = createRuntime({ remoteDebugSuspend: false })
    updatePluginInstallationDebugMock.mockResolvedValue(updatedRuntime)
    const wrapper = mountCard(runtime)
    await openDialog(wrapper)

    wrapper.findAllComponents(ElSwitch)[1].vm.$emit('update:modelValue', false)
    await nextTick()
    await save(wrapper)

    expect(updatePluginInstallationDebugMock).toHaveBeenCalledWith('installation-uuid-1', {
      enabled: true,
      port: 6100,
      suspend: false,
    })
  })

  it('waits for save and submits all fields when remote debugging is disabled', async () => {
    const updatedRuntime = createRuntime({ remoteDebugEnabled: false })
    updatePluginInstallationDebugMock.mockResolvedValue(updatedRuntime)
    const wrapper = mountCard()
    await openDialog(wrapper)

    wrapper.findAllComponents(ElSwitch)[0].vm.$emit('update:modelValue', false)
    await nextTick()

    expect(updatePluginInstallationDebugMock).not.toHaveBeenCalled()
    expect(wrapper.getComponent(ElInputNumber).props('disabled')).toBe(true)
    expect(wrapper.findAllComponents(ElSwitch)[1].props('disabled')).toBe(true)

    await save(wrapper)

    expect(updatePluginInstallationDebugMock).toHaveBeenCalledWith('installation-uuid-1', {
      enabled: false,
      port: 6100,
      suspend: false,
    })
  })

  it('shows current settings but no edit entry without manage permission', () => {
    const wrapper = mountCard(createRuntime(), ['plugin:runtime:read'])

    expect(wrapper.get('[data-testid="runtime-debug-status"]').text()).toBe('已开启')
    expect(wrapper.get('[data-testid="runtime-debug-port"]').text()).toContain('6100')
    expect(wrapper.find('[data-testid="runtime-debug-edit"]').exists()).toBe(false)
  })

  it('updates the current plugin with the successful response', async () => {
    const updatedRuntime = createRuntime({
      remoteDebugEnabled: false,
      remoteDebugPort: 7000,
      remoteDebugSuspend: true,
    })
    updatePluginInstallationDebugMock.mockResolvedValue(updatedRuntime)
    const wrapper = mountCardHarness()

    await openDialog(wrapper)
    await wrapper.get('[data-testid="runtime-debug-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="runtime-debug-status"]').text()).toBe('已关闭')
    expect(wrapper.get('[data-testid="runtime-debug-port"]').text()).toContain('7000')
    expect(wrapper.get('[data-testid="runtime-debug-suspend"]').text()).toContain('是')
  })

  it('does not restart a running plugin and reports that a restart is required', async () => {
    const runningRuntime = createRuntime({ state: 'RUNNING', liveState: 'RUNNING' })
    updatePluginInstallationDebugMock.mockResolvedValue(runningRuntime)
    const successSpy = vi.spyOn(ElMessage, 'success')
    const wrapper = mountCard(runningRuntime)

    await openDialog(wrapper)
    await save(wrapper)

    expect(restartPluginInstallationMock).not.toHaveBeenCalled()
    expect(successSpy).toHaveBeenCalledWith('配置已保存，重启后生效')
  })
})
