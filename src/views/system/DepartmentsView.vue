<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  setDepartmentEnabled,
  updateDepartment,
} from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import DepartmentTreeSelect from '@/components/system/DepartmentTreeSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { DepartmentQuery, DepartmentResponse, UpsertDepartmentRequest } from '@/types/system'
import { getDepartmentDescendantIds, hasSiblingDepartmentName } from '@/utils/departmentTree'
import { formatDateTime } from '@/utils/format'

type DepartmentForm = UpsertDepartmentRequest

const resourceStore = useResourceStore()
const userStore = useUserStore()
const loading = ref(false)
const departments = ref<DepartmentResponse[]>([])
const fullTree = ref<DepartmentResponse[]>([])
const query = reactive<DepartmentQuery>({ departmentName: '', enabled: '' })
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const editingId = ref<number>()
const editingRoot = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<DepartmentForm>({
  parentId: null,
  departmentName: '',
  sortOrder: 0,
  enabled: true,
})

const blockedParentIds = computed(() => {
  if (editingId.value === undefined) return []
  return [editingId.value, ...getDepartmentDescendantIds(fullTree.value, editingId.value)]
})

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新增部门' : '编辑部门'))

const rules: FormRules<DepartmentForm> = {
  departmentName: [
    { required: true, message: '请输入部门名称', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const normalized = String(value || '').trim()
        const duplicate = hasSiblingDepartmentName(
          fullTree.value,
          form.parentId,
          normalized,
          editingId.value,
        )
        callback(duplicate ? new Error('同一父部门下名称不能重复') : undefined)
      },
      trigger: ['blur', 'change'],
    },
  ],
  sortOrder: [{ required: true, message: '请输入排序值', trigger: 'change' }],
}

async function load() {
  loading.value = true
  try {
    const [filtered, complete] = await Promise.all([listDepartments(query), listDepartments()])
    departments.value = filtered
    fullTree.value = complete
  } finally {
    loading.value = false
  }
}

function resetForm(parentId: number | null = null) {
  editingId.value = undefined
  editingRoot.value = false
  Object.assign(form, {
    parentId,
    departmentName: '',
    sortOrder: 0,
    enabled: true,
  })
  formRef.value?.clearValidate()
}

async function openCreate(parent?: DepartmentResponse) {
  dialogMode.value = 'create'
  resetForm(parent?.departmentId ?? null)
  if (!fullTree.value.length) fullTree.value = await listDepartments()
  dialogVisible.value = true
}

async function openEdit(row: DepartmentResponse) {
  dialogMode.value = 'edit'
  resetForm()
  dialogVisible.value = true
  const detail = await getDepartment(row.departmentId)
  editingId.value = detail.departmentId
  editingRoot.value = detail.parentId === null
  Object.assign(form, {
    parentId: detail.parentId,
    departmentName: detail.departmentName,
    sortOrder: detail.sortOrder,
    enabled: detail.enabled,
  })
}

async function refreshAccessState() {
  resourceStore.invalidate('departments', 'users', 'roles')
  resourceStore.invalidateScopedData()
  await Promise.all([load(), userStore.loadProfile()])
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (editingRoot.value) form.parentId = null

  saving.value = true
  try {
    const payload: UpsertDepartmentRequest = {
      parentId: form.parentId,
      departmentName: form.departmentName.trim(),
      sortOrder: form.sortOrder,
      enabled: form.enabled,
    }
    if (dialogMode.value === 'create') {
      await createDepartment(payload)
      ElMessage.success('部门已创建')
    } else if (editingId.value !== undefined) {
      await updateDepartment(editingId.value, payload)
      ElMessage.success('部门已更新')
    }
    dialogVisible.value = false
    await refreshAccessState()
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(row: DepartmentResponse) {
  await useConfirmAction({
    title: row.enabled ? '停用部门' : '启用部门',
    message: `确认${row.enabled ? '停用' : '启用'}部门「${row.departmentName}」？`,
    successMessage: '部门状态已更新',
    action: () => setDepartmentEnabled(row.departmentId, !row.enabled),
  })
  await refreshAccessState()
}

async function remove(row: DepartmentResponse) {
  if (row.parentId === null || row.children.length > 0) return
  await useConfirmAction({
    title: '删除部门',
    message: `确认删除部门「${row.departmentName}」？`,
    successMessage: '部门已删除',
    action: () => deleteDepartment(row.departmentId),
  })
  await refreshAccessState()
}

function resetQuery() {
  query.departmentName = ''
  query.enabled = ''
  return load()
}

onMounted(load)
</script>

<template>
  <PageContainer title="部门管理" description="维护组织树、部门状态和上下级关系。">
    <template #extra>
      <PermissionGuard permission="system:department:write">
        <el-button type="primary" @click="openCreate()">新增根部门</el-button>
      </PermissionGuard>
    </template>

    <el-form class="search-form" inline :model="query">
      <el-form-item label="部门名称">
        <el-input v-model="query.departmentName" clearable placeholder="部门名称" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.enabled" clearable placeholder="全部" style="width: 140px">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table
      v-loading="loading"
      :data="departments"
      row-key="departmentId"
      default-expand-all
      border
    >
      <el-table-column prop="departmentName" label="部门名称" min-width="220" />
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="system:department:write">
            <el-button link type="primary" @click="openCreate(row)">新增子部门</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="toggleEnabled(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
          </PermissionGuard>
          <PermissionGuard permission="system:department:delete">
            <el-tooltip
              :disabled="row.parentId !== null && row.children.length === 0"
              :content="row.parentId === null ? '根部门不能删除' : '请先删除子部门'"
            >
              <span>
                <el-button
                  link
                  type="danger"
                  :disabled="row.parentId === null || row.children.length > 0"
                  @click="remove(row)"
                >
                  删除
                </el-button>
              </span>
            </el-tooltip>
          </PermissionGuard>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="父部门">
          <DepartmentTreeSelect
            v-model="form.parentId"
            :departments="fullTree"
            :blocked-ids="blockedParentIds"
            :disabled="editingRoot"
            placeholder="留空表示根部门"
          />
        </el-form-item>
        <el-alert
          v-if="editingRoot"
          title="根部门不能设置父部门。"
          type="info"
          :closable="false"
          style="margin-bottom: 14px"
        />
        <el-form-item label="部门名称" prop="departmentName">
          <el-input v-model="form.departmentName" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>
