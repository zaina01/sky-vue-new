<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import {
  batchDeletePluginAccounts,
  batchUpdatePluginAccountsGroup,
  batchUpdatePluginAccountsEnabled,
  createPluginAccount,
  deletePluginAccount,
  exportPluginAccounts,
  getPluginAccount,
  getPluginAccountSchema,
  getPluginAccountViewPreference,
  importPluginAccounts,
  listPluginAccounts,
  listPluginAccountGroups,
  setPluginAccountEnabled,
  updatePluginAccount,
  updatePluginAccountGroup,
  updatePluginAccountViewPreference,
} from '@/api/plugins'
import { isApiRequestError } from '@/api/request'
import JsonEditor from '@/components/JsonEditor/JsonEditor.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import PluginAccountColumnSettings from '@/components/plugins/PluginAccountColumnSettings.vue'
import PluginAccountGroupManager from '@/components/plugins/PluginAccountGroupManager.vue'
import PluginAccountListCell from '@/components/plugins/PluginAccountListCell.vue'
import PluginSchemaForm from '@/components/plugins/PluginSchemaForm.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useResourceStore } from '@/stores/resource'
import { usePermissionStore } from '@/stores/permission'
import type { ID } from '@/types/common'
import type {
  BatchDeletePluginAccountResponse,
  BatchUpdatePluginAccountGroupResponse,
  BatchUpdatePluginAccountStateResponse,
  PluginAccountExportFormat,
  PluginAccountExportQuery,
  PluginAccountGroup,
  PluginAccountImportResult,
  PluginAccountListField,
  PluginAccountListItem,
  PluginAccountPayload,
  PluginAccountSchemaField,
  PluginAccountViewPreference,
} from '@/types/plugins'
import { formatDateTime } from '@/utils/format'
import { pluginAccountIdentity, pluginAccountPreferenceKey } from '@/utils/pluginAccountIdentity'
import { resolvePluginAccountListFields } from '@/utils/pluginAccountListField'
import {
  buildSchemaModel,
  mergeAccountModel,
  parseJsonObject,
  resolveAccountIdField,
  resolveAccountSchemaResponse,
  safeParseJsonObject,
  stringifyJsonObject,
  type SchemaModel,
} from '@/utils/pluginSchemaForm'

const props = defineProps<{ installationId: string }>()
const resourceStore = useResourceStore()
const permissionStore = usePermissionStore()
const loading = ref(false)
const items = ref<PluginAccountListItem[]>([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
type GroupFilter = 'all' | 'ungrouped' | number
const query = reactive({
  enabled: '' as boolean | '',
  accountId: '',
  displayName: '',
  group: 'all' as GroupFilter,
})
const groups = ref<PluginAccountGroup[]>([])
const groupsLoading = ref(false)
const groupsReady = ref(false)
const groupsError = ref(false)
const groupManagerVisible = ref(false)
const moveVisible = ref(false)
const movingAccountIds = ref<string[]>([])
const moveMode = ref<'single' | 'batch'>('single')
const moveGroupId = ref<number | null>(null)
const editingGroupName = ref('')
let groupSequence = 0
let operationGeneration = 0
const selectedAccounts = ref<PluginAccountListItem[]>([])
const accountTableRef = ref<{
  clearSelection: () => void
  toggleRowSelection: (row: PluginAccountListItem, selected?: boolean) => void
}>()
const accountSchemaFields = ref<PluginAccountSchemaField[]>([])
const accountIdField = ref('')
const columnPreferenceLoading = ref(true)
const columnPreferenceReady = ref(false)
const columnSettingsVisible = ref(false)
const columnPreferenceSaving = ref(false)
const columnFields = ref<string[]>([])
const availableColumnFields = ref<PluginAccountListField[]>([])
const maxColumnFields = ref(5)
const editingColumnFields = ref<string[]>([])
let loadSequence = 0
let detailSequence = 0

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const editingAccountId = ref<ID>()
const editingInstallationId = ref('')
const editorMode = ref<'form' | 'json'>('json')
const jsonValid = ref(true)
const schemaValid = ref(true)
const schemaModel = ref<SchemaModel>({})
const originalAccountObject = ref<SchemaModel>({})
const parseFailed = ref(false)
const displayNameField = ref('')
const form = reactive<PluginAccountPayload>({
  accountId: '',
  displayName: '',
  enabled: true,
  accountJson: '{}',
})

const exportVisible = ref(false)
const exporting = ref(false)
const exportForm = reactive({
  format: 'csv' as PluginAccountExportFormat,
  enabled: '' as boolean | '',
  includeSecret: false,
  accountId: '',
  displayName: '',
  group: 'all' as GroupFilter,
})
const importVisible = ref(false)
const importing = ref(false)
const importDryRun = ref(true)
const importResult = ref<PluginAccountImportResult>()
const batchOperating = ref(false)
const batchResultVisible = ref(false)
const batchResultMode = ref<'state' | 'delete' | 'group'>('state')
const batchResult = ref<
  | BatchUpdatePluginAccountStateResponse
  | BatchDeletePluginAccountResponse
  | BatchUpdatePluginAccountGroupResponse
>()

const storagePrefix = 'plugin-account-display-name-field:'
const createGroupSelection = computed<number | 'ungrouped'>({
  get: () => form.groupId ?? 'ungrouped',
  set: (value) => {
    form.groupId = value === 'ungrouped' ? null : value
  },
})
const moveGroupSelection = computed<number | 'ungrouped'>({
  get: () => moveGroupId.value ?? 'ungrouped',
  set: (value) => {
    moveGroupId.value = value === 'ungrouped' ? null : value
  },
})
const hasSchema = computed(() => accountSchemaFields.value.length > 0)
const hasAccountIdSchema = computed(() =>
  Boolean(accountIdField.value || accountSchemaFields.value.some((field) => field.accountId)),
)
const selectedAccountIds = computed(() =>
  selectedAccounts.value.map((item) => String(item.accountId)),
)
const failedBatchReceipts = computed(
  () => batchResult.value?.receipts.filter((receipt) => !receipt.success) || [],
)
const batchResultTitle = computed(() =>
  batchResultMode.value === 'delete'
    ? '批量删除结果'
    : batchResultMode.value === 'group'
      ? '批量移动分组结果'
      : '批量操作结果',
)
const dynamicColumnFields = computed(() =>
  resolvePluginAccountListFields(columnFields.value, availableColumnFields.value),
)
const tableLayoutKey = computed(() => JSON.stringify([props.installationId, columnFields.value]))
const canSave = computed(() => {
  if (dialogLoading.value || saving.value) return false
  if (dialogMode.value === 'create' && form.groupId != null && !groupsReady.value) return false
  return editorMode.value === 'form' ? hasSchema.value && schemaValid.value : jsonValid.value
})
const formRules: FormRules<PluginAccountPayload> = {
  accountId: [{ required: true, message: '请输入账户 ID', trigger: 'blur' }],
  accountJson: [{ required: true, message: '请输入账户 JSON', trigger: 'blur' }],
}

function resetInstanceState() {
  operationGeneration += 1
  groupSequence += 1
  groups.value = []
  groupsReady.value = false
  groupsLoading.value = false
  groupsError.value = false
  groupManagerVisible.value = false
  moveVisible.value = false
  movingAccountIds.value = []
  batchOperating.value = false
  saving.value = false
  importing.value = false
  exporting.value = false
  exportVisible.value = false
  importVisible.value = false
  importResult.value = undefined
  Object.assign(query, { enabled: '', accountId: '', displayName: '', group: 'all' })
  loadSequence += 1
  detailSequence += 1
  items.value = []
  total.value = 0
  page.value = 1
  selectedAccounts.value = []
  accountSchemaFields.value = []
  accountIdField.value = ''
  columnFields.value = []
  availableColumnFields.value = []
  maxColumnFields.value = 5
  editingColumnFields.value = []
  columnPreferenceLoading.value = true
  columnPreferenceReady.value = false
  columnSettingsVisible.value = false
  dialogVisible.value = false
  batchResultVisible.value = false
  batchResult.value = undefined
  resetForm()
}

function resetForm() {
  editingAccountId.value = undefined
  editingInstallationId.value = ''
  editorMode.value = 'json'
  jsonValid.value = true
  schemaValid.value = true
  schemaModel.value = {}
  originalAccountObject.value = {}
  parseFailed.value = false
  displayNameField.value = ''
  form.groupId = null
  editingGroupName.value = ''
  Object.assign(form, { accountId: '', displayName: '', enabled: true, accountJson: '{}' })
  formRef.value?.clearValidate()
}

function storageKey(installationId: string, accountId: string) {
  return pluginAccountPreferenceKey(storagePrefix, installationId, accountId)
}

function loadDisplayNameField(installationId: string, accountId: string) {
  const saved = localStorage.getItem(storageKey(installationId, accountId)) || ''
  displayNameField.value = accountSchemaFields.value.some((field) => field.name === saved)
    ? saved
    : ''
}

function saveDisplayNameField(value: string) {
  const installationId = editingInstallationId.value || props.installationId
  const accountId = String(editingAccountId.value ?? (form.accountId || '__new__'))
  if (!installationId) return
  if (value) localStorage.setItem(storageKey(installationId, accountId), value)
  else localStorage.removeItem(storageKey(installationId, accountId))
}

function groupParams(value: GroupFilter) {
  if (typeof value === 'number') return { groupId: value }
  if (value === 'ungrouped') return { ungrouped: true }
  return {}
}

async function loadGroups() {
  const installationId = props.installationId
  const sequence = ++groupSequence
  groupsReady.value = false
  groupsError.value = false
  if (!installationId || !permissionStore.can('plugin:account:read')) {
    groups.value = []
    return
  }
  groupsLoading.value = true
  try {
    const response = await listPluginAccountGroups(installationId)
    if (sequence !== groupSequence || props.installationId !== installationId) return
    groups.value = response
    groupsReady.value = true
  } catch {
    if (sequence === groupSequence) {
      groups.value = []
      groupsError.value = true
    }
  } finally {
    if (sequence === groupSequence) groupsLoading.value = false
  }
}

async function refreshAccountsAndGroups(installationId: string, failedIds?: Set<string>) {
  if (installationId !== props.installationId) return
  await Promise.all([loadAccounts(), loadGroups()])
  if (installationId !== props.installationId) return
  const lastPage = Math.max(1, Math.ceil(total.value / size.value))
  if (page.value > lastPage) {
    page.value = lastPage
    await loadAccounts()
  }
  if (failedIds && installationId === props.installationId)
    await restoreFailedAccountSelection(failedIds)
}

async function groupChanged(deletedGroupId?: number) {
  if (deletedGroupId !== undefined && query.group === deletedGroupId) {
    query.group = 'all'
    page.value = 1
  }
  if (deletedGroupId !== undefined && exportForm.group === deletedGroupId)
    exportVisible.value = false
  resourceStore.invalidate('pluginAccounts', 'pluginAudit')
  await refreshAccountsAndGroups(props.installationId)
}

function openMove(row?: PluginAccountListItem) {
  if (!groupsReady.value || batchOperating.value || !permissionStore.can('plugin:account:write'))
    return
  moveMode.value = row ? 'single' : 'batch'
  movingAccountIds.value = row ? [String(row.accountId)] : [...selectedAccountIds.value]
  if (!movingAccountIds.value.length) return
  moveGroupId.value = row?.groupId ?? null
  moveVisible.value = true
}

async function moveAccounts() {
  if (batchOperating.value || !groupsReady.value || !permissionStore.can('plugin:account:write'))
    return
  const installationId = props.installationId
  const generation = operationGeneration
  const accountIds = [...movingAccountIds.value]
  const groupId = moveGroupId.value
  if (!accountIds.length) return
  batchOperating.value = true
  try {
    let failedIds: Set<string> | undefined
    if (moveMode.value === 'single') {
      await updatePluginAccountGroup(installationId, accountIds[0]!, { groupId })
      if (generation !== operationGeneration) return
      ElMessage.success(groupId === null ? '账户已移出分组' : '账户分组已更新')
    } else {
      const response = await batchUpdatePluginAccountsGroup(installationId, { accountIds, groupId })
      if (generation !== operationGeneration) return
      batchResult.value = response
      batchResultMode.value = 'group'
      batchResultVisible.value = true
      failedIds = new Set(
        response.receipts
          .filter((receipt) => !receipt.success && receipt.accountId !== null)
          .map((receipt) => String(receipt.accountId)),
      )
      if (response.succeeded === 0) {
        moveVisible.value = false
        return
      }
    }
    moveVisible.value = false
    resourceStore.invalidate('pluginAccounts', 'pluginAudit')
    await refreshAccountsAndGroups(installationId, failedIds)
  } catch (error) {
    if (
      generation === operationGeneration &&
      isApiRequestError(error) &&
      (error.status === 404 || error.code === 404001)
    ) {
      await loadGroups()
    }
    // Keep the move dialog and selection when the overall request fails.
  } finally {
    if (generation === operationGeneration) batchOperating.value = false
  }
}

async function fetchSchema(installationId: string) {
  const response = await getPluginAccountSchema(installationId)
  const schema = resolveAccountSchemaResponse(response)
  return {
    fields: schema?.fields || [],
    accountIdField: resolveAccountIdField(schema),
  }
}

function applyColumnPreference(preference: PluginAccountViewPreference) {
  if (preference.installationId !== props.installationId) return
  const availableFields = Array.isArray(preference.availableFields)
    ? preference.availableFields
    : []
  const availableNames = new Set(availableFields.map((field) => field.name))
  const maxFields =
    Number.isInteger(preference.maxFields) && preference.maxFields >= 0 ? preference.maxFields : 5
  const seen = new Set<string>()

  availableColumnFields.value = availableFields
  maxColumnFields.value = maxFields
  columnFields.value = (Array.isArray(preference.fields) ? preference.fields : [])
    .filter((name) => {
      if (!availableNames.has(name) || seen.has(name)) return false
      seen.add(name)
      return true
    })
    .slice(0, maxFields)
}

function accountListQuery() {
  return {
    page: page.value,
    size: size.value,
    enabled: query.enabled,
    accountId: query.accountId || undefined,
    displayName: query.displayName || undefined,
    ...groupParams(query.group),
  }
}

function commitAccountList(
  installationId: string,
  sequence: number,
  response: Awaited<ReturnType<typeof listPluginAccounts>>,
  showSuccess: boolean,
) {
  if (sequence !== loadSequence || props.installationId !== installationId) return
  items.value = response.items
  total.value = response.total
  page.value = response.page
  size.value = response.size
  selectedAccounts.value = []
  if (showSuccess) ElMessage.success('实例账户查询成功')
}

async function loadAccounts(showSuccess = false) {
  const installationId = props.installationId
  if (!installationId) return
  const sequence = ++loadSequence
  loading.value = true
  try {
    const response = await listPluginAccounts(installationId, accountListQuery())
    commitAccountList(installationId, sequence, response, showSuccess)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function load(showSuccess = false) {
  const installationId = props.installationId
  if (!installationId) return
  void loadGroups()
  const sequence = ++loadSequence
  loading.value = true
  columnPreferenceLoading.value = true
  try {
    const [preference, schema, response] = await Promise.all([
      getPluginAccountViewPreference(installationId),
      fetchSchema(installationId),
      listPluginAccounts(installationId, accountListQuery()),
    ])
    if (sequence !== loadSequence || props.installationId !== installationId) return
    applyColumnPreference(preference)
    accountSchemaFields.value = schema.fields
    accountIdField.value = schema.accountIdField
    commitAccountList(installationId, sequence, response, showSuccess)
    columnPreferenceReady.value = true
  } finally {
    if (sequence === loadSequence) {
      loading.value = false
      columnPreferenceLoading.value = false
      columnPreferenceReady.value = true
    }
  }
}

function openColumnSettings() {
  editingColumnFields.value = [...columnFields.value]
  columnSettingsVisible.value = true
}

function restoreDefaultColumns() {
  editingColumnFields.value = []
}

async function refreshColumnPreferenceAfterConflict(installationId: string) {
  const preference = await getPluginAccountViewPreference(installationId)
  if (props.installationId !== installationId) return
  const draft = [...editingColumnFields.value]
  applyColumnPreference(preference)
  const availableNames = new Set(availableColumnFields.value.map((field) => field.name))
  editingColumnFields.value = draft.filter((name) => availableNames.has(name))
  await loadAccounts()
  ElMessage.warning('插件账户字段已更新，请检查当前选择后重试')
}

async function saveColumnPreference() {
  if (columnPreferenceSaving.value) return
  const installationId = props.installationId
  if (!installationId) return
  const submittedColumnFields = [...editingColumnFields.value]
  columnPreferenceSaving.value = true
  try {
    const preference = await updatePluginAccountViewPreference(installationId, {
      fields: submittedColumnFields,
    })
    if (props.installationId !== installationId) return
    applyColumnPreference(preference)
    columnSettingsVisible.value = false
    ElMessage.success('账户列表列设置已保存')
    await loadAccounts()
  } catch (error) {
    if (
      props.installationId === installationId &&
      isApiRequestError(error) &&
      (error.status === 400 || error.code === 400001)
    ) {
      await refreshColumnPreferenceAfterConflict(installationId).catch(() => undefined)
    }
  } finally {
    columnPreferenceSaving.value = false
  }
}

function setupSchema(existing: SchemaModel, mode: 'create' | 'edit') {
  schemaModel.value = buildSchemaModel(accountSchemaFields.value, existing, mode)
  editorMode.value = hasSchema.value && !parseFailed.value ? 'form' : 'json'
}

function openCreate() {
  resetForm()
  dialogMode.value = 'create'
  editingInstallationId.value = props.installationId
  loadDisplayNameField(props.installationId, '__new__')
  setupSchema({}, 'create')
  dialogVisible.value = true
}

async function openEdit(row: PluginAccountListItem) {
  resetForm()
  dialogMode.value = 'edit'
  editingInstallationId.value = props.installationId
  editingAccountId.value = row.accountId
  dialogVisible.value = true
  dialogLoading.value = true
  const sequence = ++detailSequence
  const cacheKey = pluginAccountIdentity(props.installationId, row.accountId)
  try {
    const detail = await getPluginAccount(props.installationId, row.accountId)
    if (
      sequence !== detailSequence ||
      pluginAccountIdentity(props.installationId, row.accountId) !== cacheKey
    ) {
      return
    }
    const accountJson = detail.accountJson || detail.configJson || '{}'
    Object.assign(form, {
      accountId: String(detail.accountId),
      displayName: detail.displayName || detail.accountName || '',
      enabled: detail.enabled,
      accountJson,
      groupId: detail.groupId,
    })
    editingGroupName.value = detail.groupName || '未分组'
    try {
      originalAccountObject.value = parseJsonObject(accountJson)
    } catch {
      originalAccountObject.value = {}
      parseFailed.value = true
    }
    loadDisplayNameField(props.installationId, String(row.accountId))
    setupSchema(originalAccountObject.value, 'edit')
    jsonValid.value = !parseFailed.value
  } finally {
    if (sequence === detailSequence) dialogLoading.value = false
  }
}

function syncDerivedFields() {
  if (accountIdField.value) {
    const value = schemaModel.value[accountIdField.value]
    if (value !== undefined && value !== null) form.accountId = String(value)
  }
  if (displayNameField.value) {
    const value = schemaModel.value[displayNameField.value]
    form.displayName = value === undefined || value === null ? '' : String(value)
  }
}

function buildAccountJson() {
  if (editorMode.value === 'json') return form.accountJson
  return stringifyJsonObject(
    mergeAccountModel(
      originalAccountObject.value,
      accountSchemaFields.value,
      schemaModel.value,
      dialogMode.value,
    ),
  )
}

function syncJsonFromForm() {
  if (!hasSchema.value) return
  form.accountJson = stringifyJsonObject(
    mergeAccountModel(
      safeParseJsonObject(form.accountJson),
      accountSchemaFields.value,
      schemaModel.value,
      dialogMode.value,
    ),
  )
  jsonValid.value = true
}

async function saveAccount() {
  syncDerivedFields()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !canSave.value) return
  const installationId = editingInstallationId.value
  if (!installationId || installationId !== props.installationId) return
  const payload: PluginAccountPayload = {
    accountId: form.accountId,
    displayName: form.displayName || undefined,
    enabled: form.enabled,
    accountJson: buildAccountJson(),
  }
  saving.value = true
  const generation = operationGeneration
  try {
    if (dialogMode.value === 'create') {
      if (form.groupId !== null && form.groupId !== undefined) payload.groupId = form.groupId
      await createPluginAccount(installationId, payload)
      if (generation !== operationGeneration) return
      ElMessage.success('实例账户已创建')
    } else if (editingAccountId.value !== undefined) {
      await updatePluginAccount(installationId, editingAccountId.value, payload)
      if (generation !== operationGeneration) return
      ElMessage.success('实例账户已更新')
    }
    dialogVisible.value = false
    resourceStore.invalidate('pluginAccounts', 'pluginAudit')
    await refreshAccountsAndGroups(installationId)
  } finally {
    if (generation === operationGeneration) saving.value = false
  }
}

async function toggle(row: PluginAccountListItem) {
  const installationId = props.installationId
  const generation = operationGeneration
  await useConfirmAction({
    title: row.enabled ? '禁用账户' : '启用账户',
    message: `确认${row.enabled ? '禁用' : '启用'}账户「${row.accountId}」？`,
    action: () =>
      generation === operationGeneration
        ? setPluginAccountEnabled(installationId, row.accountId, !row.enabled)
        : Promise.resolve(),
  })
  if (generation !== operationGeneration) return
  ElMessage.success('账户状态已更新')
  resourceStore.invalidate('pluginAccounts', 'pluginAudit')
  await loadAccounts()
}

async function remove(row: PluginAccountListItem) {
  const installationId = props.installationId
  const generation = operationGeneration
  await useConfirmAction({
    title: '删除账户',
    message: `确认从当前安装实例删除账户「${row.accountId}」？`,
    action: () =>
      generation === operationGeneration
        ? deletePluginAccount(installationId, row.accountId)
        : Promise.resolve(),
  })
  if (generation !== operationGeneration) return
  ElMessage.success('账户已删除')
  resourceStore.invalidate('pluginAccounts', 'pluginAudit')
  await loadAccounts()
}

function openExport() {
  Object.assign(exportForm, {
    enabled: query.enabled,
    accountId: query.accountId,
    displayName: query.displayName,
    group: query.group,
  })
  exportVisible.value = true
}

async function exportAccounts() {
  if (exporting.value) return
  const installationId = props.installationId
  const generation = operationGeneration
  const params: PluginAccountExportQuery = {
    format: exportForm.format,
    enabled: exportForm.enabled,
    includeSecret: exportForm.includeSecret,
    accountId: exportForm.accountId || undefined,
    displayName: exportForm.displayName || undefined,
    ...groupParams(exportForm.group),
  }
  exporting.value = true
  try {
    const confirmed = await ElMessageBox.confirm(
      params.includeSecret
        ? '导出将包含敏感字段，确认继续？'
        : '确认导出当前筛选范围内的实例账户？',
      '导出账户',
      { type: params.includeSecret ? 'warning' : 'info' },
    ).then(
      () => true,
      () => false,
    )
    if (!confirmed || generation !== operationGeneration) return
    const blob = await exportPluginAccounts(installationId, params)
    if (generation !== operationGeneration) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `installation-${installationId.slice(0, 8)}-accounts.${params.format}`
    anchor.click()
    URL.revokeObjectURL(url)
    exportVisible.value = false
    ElMessage.success('账户导出已开始下载')
  } catch {
    // Shared interceptor displays export errors, including JSON error Blobs.
  } finally {
    if (generation === operationGeneration) exporting.value = false
  }
}

function beforeImport(file: File) {
  const valid = file.name.endsWith('.csv') || file.name.endsWith('.xlsx')
  if (!valid) ElMessage.error('仅支持 .csv 或 .xlsx 文件')
  return valid
}

function downloadImportTemplate() {
  if (!accountIdField.value) {
    ElMessage.warning('当前实例未提供账户 ID Schema，无法生成导入模板')
    return
  }

  const headers = accountSchemaFields.value
    .map((field) => field.name.trim())
    .filter((fieldName) => fieldName.length > 0)
  if (!headers.includes(accountIdField.value)) headers.unshift(accountIdField.value)
  headers.push('enabled')

  const csv = `\uFEFF${headers.map((header) => `"${header.replaceAll('"', '""')}"`).join(',')}\r\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `installation-${props.installationId.slice(0, 8)}-accounts-template.csv`
  anchor.click()
  URL.revokeObjectURL(url)
  ElMessage.success('账户导入模板已开始下载')
}

async function importAccounts(options: { file: File }) {
  if (importing.value) return
  const installationId = props.installationId
  const generation = operationGeneration
  const dryRun = importDryRun.value
  importing.value = true
  try {
    const response = await importPluginAccounts(installationId, options.file, {
      dryRun,
      enabledDefault: true,
    })
    if (generation !== operationGeneration) return
    importResult.value = response
    if (!dryRun) {
      resourceStore.invalidate('pluginAccounts', 'pluginAudit')
      await refreshAccountsAndGroups(installationId)
    }
    ElMessage.success(dryRun ? '预校验完成' : '账户导入完成')
  } catch {
    // Shared interceptor displays import errors.
  } finally {
    if (generation === operationGeneration) importing.value = false
  }
}

async function batchUpdate(enabled: boolean) {
  if (batchOperating.value) return
  const accountIds = [...selectedAccountIds.value]
  const installationId = props.installationId
  const generation = operationGeneration
  if (!accountIds.length) return
  batchOperating.value = true
  try {
    const confirmed = await ElMessageBox.confirm(
      `确认批量${enabled ? '启用' : '禁用'} ${accountIds.length} 个账户？`,
      '批量更新账户状态',
      { type: 'warning' },
    ).then(
      () => true,
      () => false,
    )
    if (!confirmed || generation !== operationGeneration) return
    const response = await batchUpdatePluginAccountsEnabled(installationId, {
      accountIds,
      enabled,
    })
    if (generation !== operationGeneration) return
    batchResult.value = response
    batchResultMode.value = 'state'
    batchResultVisible.value = true
    resourceStore.invalidate('pluginAccounts', 'pluginAudit')
    await loadAccounts()
  } finally {
    if (generation === operationGeneration) batchOperating.value = false
  }
}

async function restoreFailedAccountSelection(accountIds: Set<string>) {
  await nextTick()
  const failedRows = items.value.filter((item) => accountIds.has(String(item.accountId)))
  accountTableRef.value?.clearSelection()
  for (const row of failedRows) accountTableRef.value?.toggleRowSelection(row, true)
  selectedAccounts.value = failedRows
}

async function refreshAfterBatchDelete(installationId: string, failedAccountIds: Set<string>) {
  if (props.installationId !== installationId) return
  await loadAccounts()
  if (props.installationId !== installationId) return
  if (!items.value.length && page.value > 1) {
    page.value -= 1
    await loadAccounts()
  }
  if (props.installationId !== installationId) return
  await restoreFailedAccountSelection(failedAccountIds)
  await loadGroups()
}

async function batchDelete() {
  if (batchOperating.value) return
  const installationId = props.installationId
  const generation = operationGeneration
  const accountIds = [...selectedAccountIds.value]
  if (!installationId || !accountIds.length) return

  batchOperating.value = true
  try {
    const confirmed = await ElMessageBox.confirm(
      `确定删除选中的 ${accountIds.length} 个插件账户吗？删除后无法恢复。`,
      '批量删除插件账户',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    ).then(
      () => true,
      () => false,
    )
    if (!confirmed || generation !== operationGeneration) return

    const response = await batchDeletePluginAccounts(installationId, { accountIds })
    if (generation !== operationGeneration) return
    batchResult.value = response
    batchResultMode.value = 'delete'
    const failedAccountIds = new Set(
      response.receipts
        .filter((receipt) => !receipt.success && receipt.accountId !== null)
        .map((receipt) => String(receipt.accountId)),
    )

    if (response.failed === 0) {
      batchResultVisible.value = false
      ElMessage.success(`批量删除成功：已删除 ${response.succeeded} 个插件账户`)
    } else if (response.succeeded > 0) {
      batchResultVisible.value = true
      ElMessage.warning(`删除完成：成功 ${response.succeeded} 个，失败 ${response.failed} 个`)
    } else {
      batchResultVisible.value = true
      ElMessage.error(`批量删除失败：${response.failed} 个插件账户均未删除`)
    }

    if (response.succeeded > 0) {
      resourceStore.invalidate('pluginAccounts', 'pluginAudit')
      await refreshAfterBatchDelete(installationId, failedAccountIds)
    }
  } catch {
    // Request failures are displayed by the shared response interceptor.
  } finally {
    if (generation === operationGeneration) batchOperating.value = false
  }
}

function changePage(value: number) {
  page.value = value
  return loadAccounts()
}

function changeSize(value: number) {
  size.value = value
  page.value = 1
  return loadAccounts()
}

function searchAccounts() {
  page.value = 1
  return loadAccounts()
}

function resetAccountQuery() {
  Object.assign(query, { enabled: '', accountId: '', displayName: '', group: 'all' })
  page.value = 1
  return loadAccounts()
}

watch(
  () => props.installationId,
  () => {
    resetInstanceState()
    void load()
  },
)
watch(
  () => resourceStore.revisions.pluginAccounts,
  () => {
    if (!loading.value && !saving.value && !importing.value && !batchOperating.value) {
      void loadAccounts()
      void loadGroups()
    }
  },
)
onMounted(load)
onBeforeUnmount(() => {
  operationGeneration += 1
  loadSequence += 1
  detailSequence += 1
  groupSequence += 1
})
</script>

<template>
  <section class="accounts-panel">
    <div class="accounts-toolbar">
      <div><strong>实例账户</strong><small>所有请求与状态均以 installationId 隔离。</small></div>
      <div>
        <PermissionGuard permission="plugin:account:write">
          <el-button type="primary" @click="openCreate">新增账户</el-button>
          <el-button @click="importVisible = true">导入</el-button>
          <el-button @click="openExport">导出</el-button>
        </PermissionGuard>
        <PermissionGuard permission="plugin:account:read">
          <el-button :loading="groupsLoading" @click="groupManagerVisible = true"
            >分组管理</el-button
          >
          <el-button :loading="columnPreferenceLoading" @click="openColumnSettings">
            列设置
          </el-button>
        </PermissionGuard>
        <el-button :loading="loading" @click="load(true)">刷新</el-button>
      </div>
    </div>

    <el-form class="search-form" inline :model="query">
      <PermissionGuard permission="plugin:account:read">
        <el-form-item label="分组">
          <el-select
            v-model="query.group"
            :disabled="!groupsReady"
            style="width: 180px"
            data-testid="group-filter"
          >
            <el-option label="全部" value="all" />
            <el-option label="未分组" value="ungrouped" />
            <el-option
              v-for="group in groups"
              :key="group.groupId"
              :label="`${group.name} (${group.accountCount})`"
              :value="group.groupId"
            />
          </el-select>
        </el-form-item>
      </PermissionGuard>
      <el-form-item label="账户 ID"><el-input v-model="query.accountId" clearable /></el-form-item>
      <el-form-item label="显示名称"
        ><el-input v-model="query.displayName" clearable
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select v-model="query.enabled" clearable style="width: 130px"
          ><el-option label="启用" :value="true" /><el-option
            label="禁用"
            :value="false" /></el-select
      ></el-form-item>
      <el-form-item>
        <el-button type="primary" @click="searchAccounts">查询</el-button>
        <el-button @click="resetAccountQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="groupsError"
      title="分组加载失败，账户列表仍可使用。请重试后再选择或移动分组。"
      type="warning"
      :closable="false"
      show-icon
    >
      <el-button link type="primary" :loading="groupsLoading" @click="loadGroups"
        >重试分组</el-button
      >
    </el-alert>

    <div v-if="selectedAccounts.length" class="selection-bar">
      <span>已选择 {{ selectedAccounts.length }} 个账户</span>
      <PermissionGuard permission="plugin:account:write">
        <el-button size="small" :disabled="batchOperating || !groupsReady" @click="openMove()"
          >批量移动分组</el-button
        >
        <el-button
          size="small"
          :loading="batchOperating"
          :disabled="batchOperating || !selectedAccountIds.length"
          @click="batchUpdate(true)"
          >批量启用</el-button
        >
        <el-button
          size="small"
          :loading="batchOperating"
          :disabled="batchOperating || !selectedAccountIds.length"
          @click="batchUpdate(false)"
          >批量禁用</el-button
        >
        <el-button
          size="small"
          type="danger"
          :loading="batchOperating"
          :disabled="batchOperating || !selectedAccountIds.length"
          @click="batchDelete"
        >
          批量删除
        </el-button>
      </PermissionGuard>
    </div>

    <el-skeleton v-if="!columnPreferenceReady" animated :rows="6" />
    <PaginationTable
      v-else
      ref="accountTableRef"
      :key="tableLayoutKey"
      :data="items"
      :loading="loading"
      :total="total"
      :page="page"
      :size="size"
      row-key="accountId"
      border
      @selection-change="selectedAccounts = $event"
      @page-change="changePage"
      @size-change="changeSize"
    >
      <el-table-column type="selection" min-width="48" :resizable="false" />
      <el-table-column prop="accountId" label="账户 ID" min-width="90" show-overflow-tooltip />
      <el-table-column label="显示名称" min-width="80" show-overflow-tooltip
        ><template #default="{ row }">{{ row.displayName || '-' }}</template></el-table-column
      >
      <el-table-column label="状态" min-width="90"
        ><template #default="{ row }"
          ><el-tag :type="row.enabled ? 'success' : 'info'">{{
            row.enabled ? '启用' : '禁用'
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="分组" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.groupName || '未分组' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="80" show-overflow-tooltip
        ><template #default="{ row }">{{
          formatDateTime(row.createdAt)
        }}</template></el-table-column
      >
      <el-table-column label="更新时间" min-width="80" show-overflow-tooltip
        ><template #default="{ row }">{{
          formatDateTime(row.updatedAt)
        }}</template></el-table-column
      >
      <el-table-column
        v-for="field in dynamicColumnFields"
        :key="field.name"
        :label="field.label || field.name"
        min-width="50"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <PluginAccountListCell :field="field" :value="row.displayValues?.[field.name]" />
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="180" fixed="right"
        ><template #default="{ row }"
          ><PermissionGuard permission="plugin:account:write"
            ><el-button link type="primary" @click="openEdit(row)">编辑</el-button
            ><el-button
              link
              type="primary"
              :disabled="batchOperating || !groupsReady"
              @click="openMove(row)"
              >移动分组</el-button
            ><el-button link type="warning" @click="toggle(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button
            ><el-button link type="danger" @click="remove(row)">删除</el-button></PermissionGuard
          ></template
        ></el-table-column
      >
    </PaginationTable>

    <el-dialog
      v-model="columnSettingsVisible"
      title="账户列表列设置"
      width="760px"
      destroy-on-close
      @closed="editingColumnFields = []"
    >
      <PluginAccountColumnSettings
        v-model="editingColumnFields"
        :available-fields="availableColumnFields"
        :max-fields="maxColumnFields"
      />
      <el-alert
        class="column-resize-tip"
        title="列宽默认自动适配，也可临时拖动表头调整；调整结果不会保存，离开页面或修改展示列后会恢复自动布局。"
        type="info"
        :closable="false"
        show-icon
      />
      <template #footer>
        <el-button :disabled="columnPreferenceSaving" @click="restoreDefaultColumns">
          恢复默认
        </el-button>
        <el-button :disabled="columnPreferenceSaving" @click="columnSettingsVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="columnPreferenceSaving"
          :disabled="columnPreferenceSaving"
          @click="saveColumnPreference"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      class="account-editor-dialog"
      :title="dialogMode === 'create' ? '新增实例账户' : '编辑实例账户'"
      width="min(1000px, calc(100% - 32px))"
      top="5vh"
      destroy-on-close
    >
      <el-skeleton v-if="dialogLoading" animated :rows="8" />
      <div v-else class="account-editor">
        <el-alert
          v-if="parseFailed"
          title="账户 JSON 无法解析，已切换到高级 JSON。"
          type="warning"
          :closable="false"
        />
        <el-alert
          v-else-if="dialogMode === 'edit' && hasSchema && editorMode === 'json'"
          title="敏感字段留空表示不修改；只读字段和账户 ID 不会被覆盖。"
          type="info"
          :closable="false"
        />
        <section class="account-editor__section" aria-label="基础信息">
          <h3>基础信息</h3>
          <el-form
            ref="formRef"
            class="account-editor__basics"
            :model="form"
            :rules="formRules"
            label-position="top"
          >
            <el-form-item v-if="!hasAccountIdSchema" label="账户 ID" prop="accountId">
              <el-input v-model="form.accountId" :disabled="dialogMode === 'edit'" />
            </el-form-item>
            <el-form-item v-else label="账户 ID">
              {{ form.accountId || '由 Schema 字段生成' }}
            </el-form-item>
            <el-form-item v-if="hasSchema" label="显示名称字段">
              <el-select
                v-model="displayNameField"
                clearable
                style="width: 100%"
                @change="saveDisplayNameField"
              >
                <el-option
                  v-for="field in accountSchemaFields"
                  :key="field.name"
                  :label="field.label || field.name"
                  :value="field.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="显示名称"><el-input v-model="form.displayName" /></el-form-item>
            <el-form-item label="分组">
              <el-select
                v-if="dialogMode === 'create'"
                v-model="createGroupSelection"
                :disabled="!groupsReady"
                style="width: 100%"
                data-testid="create-group"
              >
                <el-option label="未分组" value="ungrouped" />
                <el-option
                  v-for="group in groups"
                  :key="group.groupId"
                  :label="group.name"
                  :value="group.groupId"
                />
              </el-select>
              <span v-else>{{ editingGroupName }}（通过账户列表的“移动分组”修改）</span>
            </el-form-item>
            <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
            <el-form-item
              v-if="!hasSchema || parseFailed"
              class="account-editor__json"
              label="账户 JSON"
              prop="accountJson"
            >
              <JsonEditor
                v-model="form.accountJson"
                style="width: 100%"
                @valid-change="jsonValid = $event"
              />
            </el-form-item>
          </el-form>
        </section>
        <section
          v-if="hasSchema && !parseFailed"
          class="account-editor__section"
          aria-label="账户参数"
        >
          <h3>账户参数</h3>
          <el-tabs v-model="editorMode" @tab-change="syncJsonFromForm">
            <el-tab-pane label="表单配置" name="form"
              ><PluginSchemaForm
                v-model="schemaModel"
                mode="account"
                :submit-mode="dialogMode"
                :account-id-field="accountIdField"
                :fields="accountSchemaFields"
                @valid-change="schemaValid = $event"
                @update:model-value="syncDerivedFields"
            /></el-tab-pane>
            <el-tab-pane label="高级 JSON" name="json"
              ><JsonEditor v-model="form.accountJson" @valid-change="jsonValid = $event"
            /></el-tab-pane>
          </el-tabs>
        </section>
      </div>
      <template #footer
        ><el-button @click="dialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="saving" :disabled="!canSave" @click="saveAccount"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="exportVisible" title="导出实例账户" width="520px"
      ><el-form label-width="120px"
        ><el-form-item label="分组范围"
          ><span>{{
            exportForm.group === 'all'
              ? '全部'
              : exportForm.group === 'ungrouped'
                ? '未分组'
                : groups.find((group) => group.groupId === exportForm.group)?.name ||
                  `分组 ${exportForm.group}`
          }}</span></el-form-item
        ><el-form-item label="账户 ID"
          ><span>{{ exportForm.accountId || '全部' }}</span></el-form-item
        ><el-form-item label="显示名称"
          ><span>{{ exportForm.displayName || '全部' }}</span></el-form-item
        ><el-form-item label="格式"
          ><el-radio-group v-model="exportForm.format"
            ><el-radio-button value="csv">CSV</el-radio-button
            ><el-radio-button value="xlsx">XLSX</el-radio-button></el-radio-group
          ></el-form-item
        ><el-form-item label="状态"
          ><el-select v-model="exportForm.enabled" clearable
            ><el-option label="启用" :value="true" /><el-option
              label="禁用"
              :value="false" /></el-select></el-form-item
        ><el-form-item label="包含敏感字段"
          ><el-switch v-model="exportForm.includeSecret" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="exportVisible = false">取消</el-button
        ><el-button type="primary" :loading="exporting" @click="exportAccounts"
          >导出</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入实例账户" width="760px"
      ><div class="import-toolbar">
        <el-switch v-model="importDryRun" :disabled="importing" active-text="仅预校验" />
        <el-button type="primary" plain @click="downloadImportTemplate">下载模板</el-button>
      </div>
      <el-alert type="info" :closable="false" style="margin-top: 14px">
        <p>
          LIST、MULTI_SELECT、OBJECT_LIST 单元格填写严格 JSON 数组，例如 ["商品A","商品B"]；MAP 填写
          JSON 对象，例如 {"key":"value"}。
        </p>
        <p>
          数组空单元格按 [] 导入，MAP 空单元格按 {} 导入；不支持逗号分隔简写。非法 JSON
          或容器类型不符仅使对应行失败。
        </p>
        <p>新导入账户默认未分组，覆盖已有账户时保留原分组。</p>
      </el-alert>
      <el-upload
        drag
        :http-request="importAccounts"
        :before-upload="beforeImport"
        :show-file-list="false"
        :disabled="importing"
        style="margin-top: 14px"
        ><div class="el-upload__text">拖拽 CSV/XLSX，或点击上传</div></el-upload
      ><el-descriptions v-if="importResult" :column="3" border style="margin-top: 14px"
        ><el-descriptions-item label="总行数">{{ importResult.totalRows }}</el-descriptions-item
        ><el-descriptions-item label="成功">{{ importResult.successRows }}</el-descriptions-item
        ><el-descriptions-item label="失败">{{
          importResult.failedRows
        }}</el-descriptions-item></el-descriptions
      >
      <el-table
        v-if="importResult"
        :data="importResult.rows"
        border
        max-height="360"
        style="margin-top: 14px"
      >
        <el-table-column prop="rowNumber" label="行号" width="70" />
        <el-table-column prop="accountId" label="账户 ID" min-width="130" show-overflow-tooltip />
        <el-table-column label="状态" width="90"
          ><template #default="{ row }">{{
            row.status === 'SUCCESS' ? '成功' : '失败'
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="90"
          ><template #default="{ row }">{{
            row.operation === 'CREATE' ? '创建' : row.operation === 'UPDATE' ? '更新' : '无变更'
          }}</template></el-table-column
        >
        <el-table-column
          prop="message"
          label="结果 / 错误原因"
          min-width="220"
          show-overflow-tooltip
        />
      </el-table>
    </el-dialog>

    <el-dialog v-model="batchResultVisible" :title="batchResultTitle" width="720px">
      <el-descriptions v-if="batchResult" :column="3" border>
        <el-descriptions-item label="总数">{{ batchResult.total }}</el-descriptions-item>
        <el-descriptions-item label="成功">{{ batchResult.succeeded }}</el-descriptions-item>
        <el-descriptions-item label="失败">{{ batchResult.failed }}</el-descriptions-item>
      </el-descriptions>
      <section v-if="failedBatchReceipts.length" class="batch-failures">
        <strong>失败明细</strong>
        <ul>
          <li
            v-for="(receipt, index) in failedBatchReceipts"
            :key="`${receipt.accountId || 'unknown'}-${index}`"
          >
            <code>{{ receipt.accountId || '未知账户' }}</code>
            <span>{{ receipt.message }}</span>
          </li>
        </ul>
      </section>
    </el-dialog>
    <el-dialog v-model="groupManagerVisible" title="账户分组管理" width="760px" destroy-on-close>
      <el-alert v-if="groupsError" title="分组加载失败" type="warning" :closable="false" />
      <el-button :loading="groupsLoading" @click="loadGroups">刷新分组</el-button>
      <PluginAccountGroupManager
        :installation-id="installationId"
        :groups="groups"
        :ready="groupsReady"
        @changed="groupChanged"
      />
    </el-dialog>

    <el-dialog
      v-model="moveVisible"
      :title="moveMode === 'single' ? '移动账户分组' : '批量移动账户分组'"
      width="520px"
    >
      <p>将 {{ movingAccountIds.length }} 个账户移动到：</p>
      <el-select
        v-model="moveGroupSelection"
        :disabled="batchOperating || !groupsReady"
        style="width: 100%"
        data-testid="move-group"
      >
        <el-option label="未分组（移出当前分组）" value="ungrouped" />
        <el-option
          v-for="group in groups"
          :key="group.groupId"
          :label="group.name"
          :value="group.groupId"
        />
      </el-select>
      <template #footer>
        <el-button :disabled="batchOperating" @click="moveVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="batchOperating"
          :disabled="!groupsReady"
          @click="moveAccounts"
          >确认移动</el-button
        >
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
/* ElDialog forwards this class to its panel without the view's scoped attribute. */
:global(.account-editor-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  margin-bottom: 0;
  border-radius: 16px;
}

:global(.account-editor-dialog .el-dialog__header),
:global(.account-editor-dialog .el-dialog__footer) {
  flex-shrink: 0;
}

:global(.account-editor-dialog .el-dialog__body) {
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.account-editor {
  container: account-editor / inline-size;
  display: grid;
  gap: 20px;
}

.account-editor__section {
  min-width: 0;
}

.account-editor__section h3 {
  margin: 0 0 14px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
}

.account-editor__basics {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 16px 20px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-extra-light);
}

.account-editor__basics > :deep(.el-form-item) {
  min-width: 0;
  margin: 0;
}

.account-editor__basics :deep(.el-form-item__label) {
  height: auto;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.account-editor__basics :deep(.el-form-item__content) {
  overflow-wrap: anywhere;
}

.account-editor__basics :deep(.el-form-item__error) {
  position: static;
  width: 100%;
  padding-top: 6px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.account-editor__json {
  grid-column: 1 / -1;
}

@container account-editor (min-width: 640px) {
  .account-editor__basics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.accounts-panel,
.accounts-toolbar > div:first-child {
  display: grid;
  gap: 12px;
}

.accounts-toolbar,
.selection-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.accounts-toolbar small {
  color: var(--el-text-color-secondary);
}

.selection-bar {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}

.column-resize-tip {
  margin-top: 16px;
}

.import-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.batch-failures {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.batch-failures ul {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.batch-failures li {
  display: grid;
  grid-template-columns: minmax(120px, 0.35fr) minmax(0, 1fr);
  gap: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-danger-light-9);
}
</style>
