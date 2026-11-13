<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createRole,
  deleteRole,
  listAllPermissions,
  listDepartments,
  listRoles,
  updateRole,
  updateRoleDataScope,
  updateRolePermissions,
} from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PermissionGuard from '@/components/PermissionGuard/PermissionGuard.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import DepartmentTreeSelect from '@/components/system/DepartmentTreeSelect.vue'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { usePagination } from '@/composables/usePagination'
import { useResourceStore } from '@/stores/resource'
import { useUserStore } from '@/stores/user'
import type { ID } from '@/types/common'
import type {
  DataScopeType,
  DepartmentResponse,
  PermissionItem,
  RoleItem,
  RolePayload,
  RoleQuery,
} from '@/types/system'
import {
  DATA_SCOPE_OPTIONS,
  dataScopeLabel,
  normalizeRoleDataScope,
  validateRoleDataScope,
} from '@/utils/dataScope'

interface RoleForm extends RolePayload {
  dataScope: DataScopeType
  departmentIds: number[]
}

const resourceStore = useResourceStore()
const userStore = useUserStore()
const table = usePagination<RoleItem, Omit<RoleQuery, 'page' | 'size'>>(
  { roleName: '' },
  (params) => listRoles(params),
)

const roleDialogVisible = ref(false)
const roleDialogMode = ref<'create' | 'edit'>('create')
const roleDialogLoading = ref(false)
const roleSaving = ref(false)
const roleFormRef = ref<FormInstance>()
const editingRoleId = ref<ID>()
const departmentTree = ref<DepartmentResponse[]>([])
const roleForm = reactive<RoleForm>({
  roleName: '',
  description: '',
  dataScope: 'SELF',
  departmentIds: [],
})

const permissionDialogVisible = ref(false)
const permissionLoading = ref(false)
const permissionSaving = ref(false)
const permissionKeyword = ref('')
const assigningRole = ref<RoleItem>()
const permissions = ref<PermissionItem[]>([])
const selectedPermissions = ref<string[]>([])

const roleDialogTitle = computed(() =>
  roleDialogMode.value === 'create' ? '创建角色' : '编辑角色',
)
const isAdminRole = computed(() => roleForm.roleName === 'ADMIN')
const roleRules: FormRules<RoleForm> = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  departmentIds: [
    {
      validator: (_rule, value, callback) => {
        if (!validateRoleDataScope(roleForm.dataScope, Array.isArray(value) ? value : [])) {
          callback(new Error('自定义部门范围至少选择一个部门'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}

const groupedPermissions = computed(() => {
  const keyword = permissionKeyword.value.trim().toLowerCase()
  const filtered = permissions.value.filter((item) => {
    if (!keyword) return true
    return [permissionModule(item.permissionName), item.permissionName, item.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })
  const groups = new Map<string, PermissionItem[]>()
  filtered.forEach((item) => {
    const module = permissionModule(item.permissionName)
    groups.set(module, [...(groups.get(module) || []), item])
  })
  return Array.from(groups.entries()).map(([module, items]) => ({ module, items }))
})

function permissionModule(permissionName: string) {
  return permissionName.split(':')[0] || permissionName.split('_')[0] || '未分组'
}

function resetRoleForm() {
  editingRoleId.value = undefined
  Object.assign(roleForm, {
    roleName: '',
    description: '',
    dataScope: 'SELF' as DataScopeType,
    departmentIds: [],
  })
  roleFormRef.value?.clearValidate()
}

async function loadDepartmentTree() {
  departmentTree.value = await listDepartments()
}

async function openCreateDialog() {
  roleDialogMode.value = 'create'
  resetRoleForm()
  roleDialogVisible.value = true
  roleDialogLoading.value = true
  try {
    await loadDepartmentTree()
  } finally {
    roleDialogLoading.value = false
  }
}

async function openEditDialog(row: RoleItem) {
  roleDialogMode.value = 'edit'
  resetRoleForm()
  editingRoleId.value = row.roleId
  Object.assign(roleForm, {
    roleName: row.roleName,
    description: row.description || '',
    dataScope: row.roleName === 'ADMIN' ? 'ALL' : row.dataScope,
    departmentIds: row.roleName === 'ADMIN' ? [] : [...row.departmentIds],
  })
  roleDialogVisible.value = true
  roleDialogLoading.value = true
  try {
    await loadDepartmentTree()
  } finally {
    roleDialogLoading.value = false
  }
}

async function refreshAccess() {
  resourceStore.invalidate('roles')
  resourceStore.invalidateScopedData()
  await Promise.all([table.load(), userStore.loadProfile()])
}

async function saveRole() {
  const valid = await roleFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const { dataScope, departmentIds } = normalizeRoleDataScope(
    roleForm.roleName,
    roleForm.dataScope,
    roleForm.departmentIds,
  )
  const basePayload: RolePayload = {
    roleName: roleForm.roleName,
    description: roleForm.description,
  }

  roleSaving.value = true
  try {
    if (roleDialogMode.value === 'create') {
      const created = await createRole(basePayload)
      try {
        await updateRoleDataScope(created.roleId, { dataScope, departmentIds })
        ElMessage.success('角色已创建')
      } catch {
        ElMessage.warning('角色已创建，但数据范围仍为后端默认值，请重新编辑该角色')
      }
    } else if (editingRoleId.value !== undefined) {
      await updateRole(editingRoleId.value, basePayload)
      if (!isAdminRole.value) {
        await updateRoleDataScope(editingRoleId.value, { dataScope, departmentIds })
      }
      ElMessage.success('角色已更新')
    }
    roleDialogVisible.value = false
    await refreshAccess()
  } finally {
    roleSaving.value = false
  }
}

async function openPermissionDialog(row: RoleItem) {
  assigningRole.value = row
  selectedPermissions.value = [...row.permissions]
  permissionKeyword.value = ''
  permissionDialogVisible.value = true
  permissionLoading.value = true
  try {
    permissions.value = await listAllPermissions()
  } finally {
    permissionLoading.value = false
  }
}

async function savePermissions() {
  if (!assigningRole.value) return
  permissionSaving.value = true
  try {
    await updateRolePermissions(assigningRole.value.roleId, selectedPermissions.value)
    ElMessage.success('角色权限已更新')
    permissionDialogVisible.value = false
    await refreshAccess()
  } finally {
    permissionSaving.value = false
  }
}

async function remove(row: RoleItem) {
  await useConfirmAction({
    title: '删除角色',
    message: `确认删除角色「${row.roleName}」？`,
    successMessage: '角色已删除',
    action: () => deleteRole(row.roleId),
  })
  await refreshAccess()
}

watch(
  () => roleForm.roleName,
  (value) => {
    if (value === 'ADMIN') {
      roleForm.dataScope = 'ALL'
      roleForm.departmentIds = []
    }
  },
)

watch(
  () => roleForm.dataScope,
  (value) => {
    if (value !== 'CUSTOM') roleForm.departmentIds = []
    void roleFormRef.value?.validateField('departmentIds').catch(() => undefined)
  },
)

onMounted(table.load)
</script>

<template>
  <PageContainer title="角色管理" description="功能权限决定能否操作，数据范围决定能操作哪些数据。">
    <template #extra>
      <PermissionGuard permission="system:role:write">
        <el-button type="primary" @click="openCreateDialog">创建角色</el-button>
      </PermissionGuard>
    </template>

    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="角色名称">
        <el-input v-model="table.query.roleName" clearable placeholder="角色名称" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="table.load">查询</el-button>
        <el-button @click="table.reset">重置</el-button>
      </el-form-item>
    </el-form>

    <PaginationTable
      :data="table.items.value"
      :loading="table.loading.value"
      :total="table.total.value"
      :page="table.page.value"
      :size="table.size.value"
      @page-change="table.changePage"
      @size-change="table.changeSize"
    >
      <el-table-column prop="roleName" label="角色名称" min-width="150" />
      <el-table-column prop="description" label="描述" min-width="220" />
      <el-table-column label="数据范围" min-width="170">
        <template #default="{ row }">
          <el-tag :type="row.roleName === 'ADMIN' ? 'danger' : 'info'">
            {{ dataScopeLabel(row.roleName === 'ADMIN' ? 'ALL' : row.dataScope) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="权限数量" width="110">
        <template #default="{ row }">{{ row.permissions.length }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="180" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="system:role:write">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" @click="openPermissionDialog(row)">分配权限</el-button>
          </PermissionGuard>
          <PermissionGuard permission="system:role:delete">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="roleDialogVisible" :title="roleDialogTitle" width="680px" destroy-on-close>
      <el-skeleton v-if="roleDialogLoading" animated :rows="7" />
      <el-form v-else ref="roleFormRef" :model="roleForm" :rules="roleRules" label-width="110px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="roleForm.roleName" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-divider content-position="left">数据权限</el-divider>
        <el-alert
          title="功能权限决定能否操作；数据范围由后端结合当前功能权限按多角色并集计算。"
          type="info"
          :closable="false"
          style="margin-bottom: 14px"
        />
        <el-form-item label="数据范围">
          <el-radio-group v-model="roleForm.dataScope" :disabled="isAdminRole">
            <el-radio v-for="item in DATA_SCOPE_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="roleForm.dataScope === 'CUSTOM'" label="授权部门" prop="departmentIds">
          <DepartmentTreeSelect
            v-model="roleForm.departmentIds"
            :departments="departmentTree"
            multiple
            only-enabled
            preserve-disabled-selection
          />
        </el-form-item>
        <el-alert
          v-if="isAdminRole"
          title="ADMIN 数据范围固定为全部数据，不可修改。"
          type="warning"
          :closable="false"
        />
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="roleSaving"
          :disabled="roleDialogLoading"
          @click="saveRole"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permissionDialogVisible" title="分配权限" width="760px" destroy-on-close>
      <el-skeleton v-if="permissionLoading" animated :rows="8" />
      <template v-else>
        <el-input
          v-model="permissionKeyword"
          clearable
          placeholder="搜索模块 / 权限点 / 描述"
          style="margin-bottom: 12px"
        />
        <el-scrollbar height="420px">
          <el-checkbox-group v-model="selectedPermissions">
            <el-collapse>
              <el-collapse-item
                v-for="group in groupedPermissions"
                :key="group.module"
                :title="group.module"
              >
                <div class="permission-grid">
                  <el-checkbox
                    v-for="item in group.items"
                    :key="item.permissionId"
                    :value="item.permissionName"
                  >
                    <strong>{{ item.permissionName }}</strong>
                    <span>{{ item.description || '暂无说明' }}</span>
                  </el-checkbox>
                </div>
              </el-collapse-item>
            </el-collapse>
          </el-checkbox-group>
        </el-scrollbar>
      </template>
      <template #footer>
        <el-button @click="permissionDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="permissionSaving"
          :disabled="permissionLoading"
          @click="savePermissions"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.permission-grid {
  display: grid;
  gap: 10px;
}

.permission-grid :deep(.el-checkbox) {
  height: auto;
  white-space: normal;
}

.permission-grid strong,
.permission-grid span {
  display: block;
}

.permission-grid span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
