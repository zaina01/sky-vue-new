<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  createUser,
  deleteUser,
  getUser,
  listDepartments,
  listRoles,
  listUsers,
  resetUserPassword,
  setUserEnabled,
  updateUser,
  updateUserRoles,
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
  DepartmentResponse,
  RoleItem,
  UserCreatePayload,
  UserItem,
  UserQuery,
  UserUpdatePayload,
} from '@/types/system'
import { flattenDepartmentTree } from '@/utils/departmentTree'
import { formatDateTime } from '@/utils/format'
import { isUserDeleteConflict } from '@/utils/userDeletion'

interface UserForm {
  username: string
  email: string
  phone: string
  avatar: string
  password: string
  departmentId: number | null
  enabled: boolean
  roles: string[]
}

const router = useRouter()
const resourceStore = useResourceStore()
const userStore = useUserStore()
const table = usePagination<UserItem, Omit<UserQuery, 'page' | 'size'>>(
  { username: '', enabled: '', departmentId: '' },
  (params) => listUsers(params),
)

const departmentTree = ref<DepartmentResponse[]>([])
const userDialogVisible = ref(false)
const userDialogMode = ref<'create' | 'edit'>('create')
const userDialogLoading = ref(false)
const userSaving = ref(false)
const editingUserId = ref<ID>()
const userFormRef = ref<FormInstance>()
const userForm = reactive<UserForm>({
  username: '',
  email: '',
  phone: '',
  avatar: '',
  password: '',
  departmentId: null,
  enabled: true,
  roles: [],
})

const roleDialogVisible = ref(false)
const roleDialogLoading = ref(false)
const roleSaving = ref(false)
const roleOptions = ref<RoleItem[]>([])
const selectedRoles = ref<string[]>([])
const assigningUser = ref<UserItem>()

const deleteConflictVisible = ref(false)
const deleteConflictUser = ref<UserItem>()
const deleteConflictMessage = ref('')
const conflictOperating = ref(false)

const userDialogTitle = computed(() =>
  userDialogMode.value === 'create' ? '创建用户' : '编辑用户',
)

const userRules: FormRules<UserForm> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入合法邮箱', trigger: 'blur' },
  ],
  departmentId: [
    {
      validator: (_rule, value, callback) => {
        const enabled = flattenDepartmentTree(departmentTree.value).some(
          (department) => department.departmentId === value && department.enabled,
        )
        callback(enabled ? undefined : new Error('请选择启用的主部门'))
      },
      trigger: 'change',
    },
  ],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (userDialogMode.value === 'create' && !value) callback(new Error('请输入初始密码'))
        else if (value && value.length < 6) callback(new Error('密码长度至少 6 位'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function resetUserForm() {
  editingUserId.value = undefined
  Object.assign(userForm, {
    username: '',
    email: '',
    phone: '',
    avatar: '',
    password: '',
    departmentId: null,
    enabled: true,
    roles: [],
  })
  userFormRef.value?.clearValidate()
}

async function loadRoleOptions() {
  const response = await listRoles({ page: 1, size: 100, roleName: '' })
  roleOptions.value = response.items
}

async function loadDepartments() {
  departmentTree.value = await listDepartments()
}

async function openCreateDialog() {
  userDialogMode.value = 'create'
  resetUserForm()
  userDialogVisible.value = true
  userDialogLoading.value = true
  try {
    await Promise.all([loadRoleOptions(), loadDepartments()])
  } finally {
    userDialogLoading.value = false
  }
}

async function openEditDialog(row: UserItem) {
  userDialogMode.value = 'edit'
  resetUserForm()
  userDialogVisible.value = true
  userDialogLoading.value = true
  try {
    const [detail] = await Promise.all([getUser(row.userId), loadDepartments()])
    editingUserId.value = detail.userId
    Object.assign(userForm, {
      username: detail.username,
      email: detail.email || '',
      phone: detail.phone || '',
      avatar: detail.avatar || '',
      password: '',
      departmentId: detail.departmentId,
      enabled: detail.enabled,
      roles: detail.roles || [],
    })
  } finally {
    userDialogLoading.value = false
  }
}

function buildCreatePayload(): UserCreatePayload {
  return {
    username: userForm.username,
    password: userForm.password,
    email: userForm.email,
    phone: userForm.phone || undefined,
    avatar: userForm.avatar || undefined,
    departmentId: userForm.departmentId!,
    enabled: userForm.enabled,
    roles: userForm.roles,
  }
}

function buildUpdatePayload(): UserUpdatePayload {
  return {
    email: userForm.email,
    phone: userForm.phone || undefined,
    avatar: userForm.avatar || undefined,
    departmentId: userForm.departmentId!,
    enabled: userForm.enabled,
  }
}

async function refreshAccess() {
  resourceStore.invalidate('users')
  resourceStore.invalidateScopedData()
  await Promise.all([table.load(), userStore.loadProfile()])
}

async function saveUser() {
  const valid = await userFormRef.value?.validate().catch(() => false)
  if (!valid || userForm.departmentId === null) return
  userSaving.value = true
  try {
    if (userDialogMode.value === 'create') {
      await createUser(buildCreatePayload())
      ElMessage.success('用户已创建')
    } else if (editingUserId.value !== undefined) {
      await updateUser(editingUserId.value, buildUpdatePayload())
      ElMessage.success('用户已更新；部门调动不改变历史数据归属')
    }
    userDialogVisible.value = false
    await refreshAccess()
  } finally {
    userSaving.value = false
  }
}

async function openRoleDialog(row: UserItem) {
  assigningUser.value = row
  roleDialogVisible.value = true
  roleDialogLoading.value = true
  try {
    const [detail] = await Promise.all([getUser(row.userId), loadRoleOptions()])
    selectedRoles.value = detail.roles || []
  } finally {
    roleDialogLoading.value = false
  }
}

async function saveUserRoles() {
  if (!assigningUser.value) return
  roleSaving.value = true
  try {
    await updateUserRoles(assigningUser.value.userId, selectedRoles.value)
    ElMessage.success('用户角色已更新')
    roleDialogVisible.value = false
    await refreshAccess()
  } finally {
    roleSaving.value = false
  }
}

async function toggleEnabled(row: UserItem) {
  await useConfirmAction({
    title: row.enabled ? '禁用用户' : '启用用户',
    message: `确认${row.enabled ? '禁用' : '启用'}用户「${row.username}」？`,
    successMessage: '状态已更新',
    action: () => setUserEnabled(row.userId, !row.enabled),
  })
  await refreshAccess()
}

async function remove(row: UserItem) {
  try {
    await useConfirmAction({
      title: '删除用户',
      message: `确认删除用户「${row.username}」？该操作不可恢复。`,
      successMessage: '用户已删除',
      action: () => deleteUser(row.userId),
    })
    await refreshAccess()
  } catch (error) {
    if (isUserDeleteConflict(error)) {
      deleteConflictUser.value = row
      deleteConflictMessage.value = error.message
      deleteConflictVisible.value = true
      return
    }
    if (error === 'cancel' || error === 'close') return
    throw error
  }
}

async function disableConflictingUser() {
  if (!deleteConflictUser.value) return
  conflictOperating.value = true
  try {
    await setUserEnabled(deleteConflictUser.value.userId, false)
    ElMessage.success('用户已停用，请完成资源转交后再删除')
    deleteConflictVisible.value = false
    await refreshAccess()
  } finally {
    conflictOperating.value = false
  }
}

function openTransfer(row?: UserItem) {
  const target = row || deleteConflictUser.value
  deleteConflictVisible.value = false
  router.push({
    path: '/system/data-ownership',
    query: target ? { sourceUserId: String(target.userId) } : undefined,
  })
}

async function resetPassword(row: UserItem) {
  const result = await ElMessageBox.prompt(`请输入用户「${row.username}」的新密码`, '重置密码', {
    confirmButtonText: '确认重置',
    cancelButtonText: '取消',
    inputType: 'password',
    inputPattern: /^.{6,}$/,
    inputErrorMessage: '密码长度至少 6 位',
  }).catch(() => undefined)
  if (!result?.value) return
  await useConfirmAction({
    title: '重置密码',
    message: `确认重置用户「${row.username}」的密码？`,
    successMessage: '密码已重置',
    action: () => resetUserPassword(row.userId, result.value),
  })
}

onMounted(async () => {
  await Promise.all([table.load(), loadDepartments()])
})
</script>

<template>
  <PageContainer title="用户管理" description="维护用户、主部门、启停状态和角色分配。">
    <template #extra>
      <PermissionGuard permission="system:data-ownership:transfer">
        <el-button @click="openTransfer()">数据转交</el-button>
      </PermissionGuard>
      <PermissionGuard permission="system:user:write">
        <el-button type="primary" @click="openCreateDialog">创建用户</el-button>
      </PermissionGuard>
    </template>

    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="用户名">
        <el-input v-model="table.query.username" clearable placeholder="用户名" />
      </el-form-item>
      <el-form-item label="部门">
        <DepartmentTreeSelect
          v-model="table.query.departmentId"
          :departments="departmentTree"
          empty-value=""
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="table.query.enabled" clearable placeholder="全部" style="width: 140px">
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
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
      <el-table-column prop="username" label="用户名" min-width="130" />
      <el-table-column prop="departmentName" label="主部门" min-width="150">
        <template #default="{ row }">{{ row.departmentName || row.departmentId || '-' }}</template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="phone" label="手机号" min-width="130" />
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="role in row.roles" :key="role" class="mr-6">{{ role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{
            row.enabled ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="180">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="400" fixed="right">
        <template #default="{ row }">
          <PermissionGuard permission="system:user:write">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" @click="openRoleDialog(row)">分配角色</el-button>
            <el-button link type="warning" @click="toggleEnabled(row)">{{
              row.enabled ? '禁用' : '启用'
            }}</el-button>
          </PermissionGuard>
          <PermissionGuard permission="system:data-ownership:transfer">
            <el-button link type="primary" @click="openTransfer(row)">转交资源</el-button>
          </PermissionGuard>
          <PermissionGuard permission="system:user:password:reset">
            <el-button link type="warning" @click="resetPassword(row)">重置密码</el-button>
          </PermissionGuard>
          <PermissionGuard permission="system:user:delete">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </PermissionGuard>
        </template>
      </el-table-column>
    </PaginationTable>

    <el-dialog v-model="userDialogVisible" :title="userDialogTitle" width="620px" destroy-on-close>
      <el-skeleton v-if="userDialogLoading" animated :rows="7" />
      <el-form v-else ref="userFormRef" :model="userForm" :rules="userRules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" :disabled="userDialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email"><el-input v-model="userForm.email" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="userForm.phone" /></el-form-item>
        <el-form-item label="头像"
          ><el-input v-model="userForm.avatar" placeholder="头像 URL"
        /></el-form-item>
        <el-form-item label="主部门" prop="departmentId">
          <DepartmentTreeSelect
            v-model="userForm.departmentId"
            :departments="departmentTree"
            only-enabled
          />
        </el-form-item>
        <el-form-item v-if="userDialogMode === 'create'" label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item v-if="userDialogMode === 'create'" label="角色">
          <el-select v-model="userForm.roles" multiple filterable style="width: 100%">
            <el-option
              v-for="role in roleOptions"
              :key="role.roleId"
              :label="role.roleName"
              :value="role.roleName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="userForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="userSaving"
          :disabled="userDialogLoading"
          @click="saveUser"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="roleDialogVisible" title="分配角色" width="560px" destroy-on-close>
      <el-skeleton v-if="roleDialogLoading" animated :rows="4" />
      <el-form v-else label-width="96px">
        <el-form-item label="用户">{{ assigningUser?.username }}</el-form-item>
        <el-form-item label="角色">
          <el-select v-model="selectedRoles" multiple filterable style="width: 100%">
            <el-option
              v-for="role in roleOptions"
              :key="role.roleId"
              :label="role.roleName"
              :value="role.roleName"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="roleSaving"
          :disabled="roleDialogLoading"
          @click="saveUserRoles"
          >保存</el-button
        >
      </template>
    </el-dialog>

    <el-dialog v-model="deleteConflictVisible" title="用户仍拥有数据资源" width="620px">
      <el-alert
        :title="deleteConflictMessage || '请先停用用户或转交资源'"
        type="warning"
        show-icon
        :closable="false"
      />
      <p>
        用户「{{ deleteConflictUser?.username }}」仍拥有插件实例、任务、通知渠道或规则，不能硬删除。
      </p>
      <template #footer>
        <el-button @click="deleteConflictVisible = false">关闭</el-button>
        <PermissionGuard permission="system:user:write">
          <el-button :loading="conflictOperating" @click="disableConflictingUser"
            >先停用用户</el-button
          >
        </PermissionGuard>
        <PermissionGuard permission="system:data-ownership:transfer">
          <el-button type="primary" @click="openTransfer()">前往数据转交</el-button>
        </PermissionGuard>
      </template>
    </el-dialog>
  </PageContainer>
</template>
