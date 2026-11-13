<script setup lang="ts">
import { DataBoard, Promotion } from '@element-plus/icons-vue'
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>

<template>
  <main class="page-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Vue 3 Starter</p>
        <h1>Sky Vue New</h1>
        <p class="subtitle">
          基于 Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router 和 Axios 的项目模板。
        </p>
      </div>

      <div class="actions">
        <el-button type="primary" size="large" :icon="Promotion" @click="counter.increment">
          计数 {{ counter.count }}
        </el-button>
        <RouterLink to="/about">
          <el-button size="large" :icon="DataBoard">查看说明</el-button>
        </RouterLink>
      </div>
    </section>

    <el-row :gutter="20" class="feature-grid">
      <el-col :xs="24" :md="8">
        <el-card shadow="hover">
          <h2>Element Plus</h2>
          <p>已完成组件库注册，可直接使用 Element Plus 组件。</p>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="hover">
          <h2>Pinia</h2>
          <p>内置示例 Store，当前双倍计数为 {{ counter.doubleCount }}。</p>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="hover">
          <h2>Axios</h2>
          <p>已封装基础 HTTP 实例，可在 src/api/http.ts 中继续扩展。</p>
        </el-card>
      </el-col>
    </el-row>
  </main>
</template>
