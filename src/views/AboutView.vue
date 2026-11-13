<template>
  <main class="page-shell">
    <el-card class="content-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>项目说明</span>
          <RouterLink to="/">
            <el-button text>返回首页</el-button>
          </RouterLink>
        </div>
      </template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="框架">Vue 3 + TypeScript + Vite</el-descriptions-item>
        <el-descriptions-item label="UI">Element Plus</el-descriptions-item>
        <el-descriptions-item label="状态管理">Pinia</el-descriptions-item>
        <el-descriptions-item label="路由">Vue Router</el-descriptions-item>
        <el-descriptions-item label="请求">Axios</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </main>
</template>
