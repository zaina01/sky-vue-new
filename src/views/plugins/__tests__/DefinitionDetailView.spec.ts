/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, inject, provide, type PropType } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getPluginDefinition,
  installPluginDependencies,
  listLocalPluginDependencyArtifacts,
  listPluginDependencies,
  uploadLocalPluginDependencyArtifact,
} from '@/api/plugins'
import type {
  LocalPluginDependencyArtifact,
  PluginDefinitionResponse,
  PluginDependencyInstallResponse,
} from '@/types/plugins'
import DefinitionDetailView from '@/views/plugins/DefinitionDetailView.vue'

const pluginId = 'vendor/demo plugin:1'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { pluginId: 'vendor/demo plugin:1' } }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/api/plugins', () => ({
  deletePluginDefinition: vi.fn(),
  getPluginDefinition: vi.fn(),
  installPluginDependencies: vi.fn(),
  listLocalPluginDependencyArtifacts: vi.fn(),
  listPluginDependencies: vi.fn(),
  reinstallPluginDependencies: vi.fn(),
  uninstallPluginDependencies: vi.fn(),
  uploadLocalPluginDependencyArtifact: vi.fn(),
}))

const getPluginDefinitionMock = vi.mocked(getPluginDefinition)
const installPluginDependenciesMock = vi.mocked(installPluginDependencies)
const listLocalPluginDependencyArtifactsMock = vi.mocked(listLocalPluginDependencyArtifacts)
const listPluginDependenciesMock = vi.mocked(listPluginDependencies)
const uploadLocalPluginDependencyArtifactMock = vi.mocked(uploadLocalPluginDependencyArtifact)

const definition: PluginDefinitionResponse = {
  pluginId,
  version: '1.0.0',
  displayName: '示例插件',
  mainClass: 'com.example.Plugin',
  artifactSha256: 'definition-sha256',
  capabilitiesJson: '{}',
  configSchemaJson: '{}',
  accountSchemaJson: '{}',
  createdAt: '2026-08-02T00:00:00',
  updatedAt: '2026-08-02T00:00:00',
}

function artifact(id: number, coordinate: string): LocalPluginDependencyArtifact {
  const [groupId, artifactId, version] = coordinate.split(':')
  return {
    id,
    groupId: groupId!,
    artifactId: artifactId!,
    version: version!,
    extension: 'jar',
    coordinate,
    relativePath: `${groupId}/${artifactId}/${version}/${artifactId}-${version}.jar`,
    sha256: `sha256-${id}`,
    originalFilename: `${artifactId}-${version}.jar`,
    sizeBytes: id * 1024,
    createdAt: '2026-08-02T00:00:00',
  }
}

const pageOneArtifact = artifact(1, 'com.example:page-one:1.0.0')
const pageTwoArtifact = artifact(2, 'com.example:page-two:2.0.0')

function installResponse(): PluginDependencyInstallResponse {
  return {
    pluginId,
    declaredDependencyCount: 0,
    resolvedDependencyCount: 0,
    dependencies: [],
  }
}

const tableRowsKey = Symbol('definition-detail-table-rows')
const SlotStub = defineComponent({ template: '<div><slot /></div>' })
const PageContainerStub = defineComponent({
  template: '<main><slot name="extra" /><slot /></main>',
})
const PermissionGuardStub = defineComponent({ template: '<div><slot /></div>' })
const ButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean, loading: Boolean },
  template: '<button type="button" :disabled="disabled"><slot /></button>',
})
const DialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean, title: String },
  emits: ['update:modelValue', 'closed'],
  template:
    '<section v-if="modelValue" class="dialog" :data-title="title"><slot /><slot name="footer" /></section>',
})
const TabsStub = defineComponent({
  name: 'ElTabs',
  props: { modelValue: String },
  emits: ['update:modelValue', 'tab-change'],
  template: '<div data-testid="dependency-tabs"><slot /></div>',
})
const TabPaneStub = defineComponent({
  name: 'ElTabPane',
  props: { label: String, name: String },
  template: '<section :data-tab="name"><h3>{{ label }}</h3><slot /></section>',
})
const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: [String, Number], default: '' },
    placeholder: String,
  },
  emits: ['update:modelValue', 'clear'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const CheckboxStub = defineComponent({
  name: 'ElCheckbox',
  props: { modelValue: Boolean, ariaLabel: String },
  emits: ['change'],
  template:
    '<button type="button" role="checkbox" :aria-label="ariaLabel" :aria-checked="modelValue" @click="$emit(\'change\', !modelValue)" />',
})
const TableStub = defineComponent({
  name: 'ElTable',
  props: { data: { type: Array as PropType<unknown[]>, default: () => [] } },
  setup(props, { slots }) {
    provide(tableRowsKey, () => props.data)
    return () => h('div', slots.default?.())
  },
})
const PaginationTableStub = defineComponent({
  name: 'PaginationTable',
  props: {
    data: { type: Array as PropType<unknown[]>, default: () => [] },
    loading: Boolean,
    total: Number,
    page: Number,
    size: Number,
  },
  emits: ['page-change', 'size-change'],
  setup(props, { slots }) {
    provide(tableRowsKey, () => props.data)
    return () => h('div', { 'data-testid': 'local-artifacts' }, slots.default?.())
  },
})
const TableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_props, { slots }) {
    const rows = inject<() => unknown[]>(tableRowsKey, () => [])
    return () =>
      h(
        'div',
        rows().flatMap((row) => slots.default?.({ row }) || []),
      )
  },
})
const FormStub = defineComponent({
  name: 'ElForm',
  setup(_props, { expose, slots }) {
    expose({
      clearValidate: () => undefined,
      validate: () => Promise.resolve(true),
    })
    return () => h('form', slots.default?.())
  },
})
const UploadStub = defineComponent({
  name: 'ElUpload',
  props: {
    disabled: Boolean,
    onChange: Function,
    onRemove: Function,
  },
  setup(_props, { expose, slots }) {
    expose({ clearFiles: () => undefined })
    return () => h('div', { 'data-testid': 'local-upload' }, [slots.default?.(), slots.tip?.()])
  },
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(DefinitionDetailView, {
    global: {
      plugins: [pinia],
      stubs: {
        PageBackButton: SlotStub,
        PageContainer: PageContainerStub,
        PermissionGuard: PermissionGuardStub,
        PaginationTable: PaginationTableStub,
        ElAlert: SlotStub,
        ElButton: ButtonStub,
        ElCard: defineComponent({ template: '<article><slot name="header" /><slot /></article>' }),
        ElCheckbox: CheckboxStub,
        ElDescriptions: SlotStub,
        ElDescriptionsItem: SlotStub,
        ElDialog: DialogStub,
        ElForm: FormStub,
        ElFormItem: SlotStub,
        ElInput: InputStub,
        ElRadioButton: SlotStub,
        ElRadioGroup: SlotStub,
        ElSkeleton: SlotStub,
        ElTabPane: TabPaneStub,
        ElTable: TableStub,
        ElTableColumn: TableColumnStub,
        ElTabs: TabsStub,
        ElUpload: UploadStub,
      },
    },
  })
}

function findButton(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text().trim() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}

async function openLocalDependencyTab(wrapper: VueWrapper) {
  await findButton(wrapper, '安装依赖').trigger('click')
  const tabs = wrapper.getComponent(TabsStub)
  tabs.vm.$emit('update:modelValue', 'local')
  tabs.vm.$emit('tab-change', 'local')
  await flushPromises()
  return wrapper.getComponent(PaginationTableStub)
}

function selectArtifact(wrapper: VueWrapper, coordinate: string) {
  const checkbox = wrapper
    .findAllComponents(CheckboxStub)
    .find((item) => item.props('ariaLabel') === `选择依赖 ${coordinate}`)
  if (!checkbox) throw new Error(`未找到本地依赖：${coordinate}`)
  checkbox.vm.$emit('change', true)
}

async function prepareUpload(wrapper: VueWrapper, file: File) {
  await findButton(wrapper, '上传本地依赖').trigger('click')
  await wrapper.get('input[placeholder="例如 com.example"]').setValue(' com.upload ')
  await wrapper.get('input[placeholder="例如 local-sdk"]').setValue(' upload-sdk ')
  await wrapper.get('input[placeholder="例如 1.0.0"]').setValue(' 3.0.0 ')
  const upload = wrapper.getComponent(UploadStub)
  const onChange = upload.props('onChange') as (value: { raw: File }) => void
  onChange({ raw: file })
  await wrapper.vm.$nextTick()
}

describe('DefinitionDetailView local dependencies', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'success').mockImplementation(() => undefined as never)
    getPluginDefinitionMock.mockResolvedValue(definition)
    listPluginDependenciesMock.mockResolvedValue([])
    listLocalPluginDependencyArtifactsMock.mockImplementation(({ page, size }) =>
      Promise.resolve({
        items: page === 2 ? [pageTwoArtifact] : [pageOneArtifact],
        page,
        size,
        total: 21,
      }),
    )
    installPluginDependenciesMock.mockResolvedValue(installResponse())
  })

  it('uses backend pagination and retains selections across pages for definition installation', async () => {
    const wrapper = mountView()
    await flushPromises()

    const pagination = await openLocalDependencyTab(wrapper)
    expect(wrapper.text()).toContain('本地依赖制品')
    expect(listLocalPluginDependencyArtifactsMock).toHaveBeenNthCalledWith(1, {
      keyword: '',
      page: 1,
      size: 10,
    })
    expect(pagination.props()).toMatchObject({ page: 1, size: 10, total: 21 })

    selectArtifact(wrapper, pageOneArtifact.coordinate)
    pagination.vm.$emit('page-change', 2)
    await flushPromises()
    expect(listLocalPluginDependencyArtifactsMock).toHaveBeenNthCalledWith(2, {
      keyword: '',
      page: 2,
      size: 10,
    })
    expect(pagination.props('page')).toBe(2)

    selectArtifact(wrapper, pageTwoArtifact.coordinate)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('已选 2 项')
    await findButton(wrapper, '安装').trigger('click')
    await flushPromises()

    expect(installPluginDependenciesMock).toHaveBeenCalledWith(pluginId, {
      dependencies: [pageOneArtifact.coordinate, pageTwoArtifact.coordinate],
      mode: 'merge',
    })
  })

  it('uploads and selects a local artifact without installing it', async () => {
    const uploaded = artifact(3, 'com.backend:normalized-sdk:3.0.0')
    uploadLocalPluginDependencyArtifactMock.mockResolvedValue(uploaded)
    const wrapper = mountView()
    await flushPromises()
    await openLocalDependencyTab(wrapper)
    const file = new File(['jar'], 'upload-sdk.jar', { type: 'application/java-archive' })
    await prepareUpload(wrapper, file)

    await findButton(wrapper, '仅上传').trigger('click')
    await flushPromises()

    expect(uploadLocalPluginDependencyArtifactMock).toHaveBeenCalledWith({
      file,
      groupId: 'com.upload',
      artifactId: 'upload-sdk',
      version: '3.0.0',
    })
    expect(installPluginDependenciesMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('已选 1 项')
  })

  it('uploads and installs through the current plugin definition', async () => {
    const uploaded = artifact(4, 'com.backend:install-now:4.0.0')
    uploadLocalPluginDependencyArtifactMock.mockResolvedValue(uploaded)
    const wrapper = mountView()
    await flushPromises()
    await openLocalDependencyTab(wrapper)
    const file = new File(['jar'], 'install-now.jar', { type: 'application/java-archive' })
    await prepareUpload(wrapper, file)

    await findButton(wrapper, '上传并安装').trigger('click')
    await flushPromises()

    expect(installPluginDependenciesMock).toHaveBeenCalledWith(pluginId, {
      dependencies: [uploaded.coordinate],
      mode: 'merge',
    })
  })
})
