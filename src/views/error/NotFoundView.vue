<template>
  <main class="error-page">
    <el-result icon="info" title="404" sub-title="页面不存在或已被移动。">
      <template #extra>
        <RouterLink to="/dashboard">
          <el-button type="primary">返回概览</el-button>
        </RouterLink>
      </template>
    </el-result>
  </main>
</template>
