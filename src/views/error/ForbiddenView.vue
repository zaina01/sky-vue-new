<template>
  <main class="error-page">
    <el-result icon="warning" title="403" sub-title="当前账号没有访问该资源的权限。">
      <template #extra>
        <RouterLink to="/dashboard">
          <el-button type="primary">返回概览</el-button>
        </RouterLink>
      </template>
    </el-result>
  </main>
</template>
