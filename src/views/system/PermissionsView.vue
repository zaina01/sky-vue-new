<script setup lang="ts">
import { onMounted } from 'vue'

import { listPermissions } from '@/api/system'
import PageContainer from '@/components/PageContainer/PageContainer.vue'
import PaginationTable from '@/components/common/PaginationTable.vue'
import { usePagination } from '@/composables/usePagination'
import type { PermissionItem, PermissionQuery } from '@/types/system'

const table = usePagination<PermissionItem, Omit<PermissionQuery, 'page' | 'size'>>(
  { permissionName: '' },
  (params) => listPermissions(params),
)

function permissionModule(permissionName: string) {
  return permissionName.split('_')[0] || permissionName.split(':')[0] || '未分组'
}

onMounted(table.load)
</script>

<template>
  <PageContainer title="权限列表" description="后端权限点只读展示，用于角色授权。">
    <el-form class="search-form" inline :model="table.query">
      <el-form-item label="权限名">
        <el-input
          v-model="table.query.permissionName"
          clearable
          placeholder="权限名"
          style="width: 260px"
        />
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
      <el-table-column label="模块" width="140">
        <template #default="{ row }">{{ permissionModule(row.permissionName) }}</template>
      </el-table-column>
      <el-table-column prop="permissionName" label="权限点" min-width="260" />
      <el-table-column prop="description" label="说明" min-width="320" />
    </PaginationTable>
  </PageContainer>
</template>
