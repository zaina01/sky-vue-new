<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

interface RequestError {
  message?: string
}

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

async function submit() {
  if (!form.username || !form.password) return
  loading.value = true
  try {
    await authStore.login(form)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } catch (error) {
    ElMessage.error((error as RequestError).message || '登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
    form.password = ''
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-panel__intro">
        <p class="eyebrow">Plugin Task Scheduler</p>
        <h1>任务调度控制台</h1>
        <p>面向插件、定时 Job、通知链路和审计日志的统一管理入口。</p>
      </div>

      <el-card class="login-card" shadow="never">
        <h2>登录后台</h2>
        <el-form :model="form" size="large" @submit.prevent="submit">
          <el-form-item>
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              placeholder="用户名"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              placeholder="密码"
              autocomplete="current-password"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button type="primary" class="login-card__submit" :loading="loading" @click="submit">
            登录
          </el-button>
          <div class="login-card__hint">
            <span>如系统首次部署，</span>
            <RouterLink to="/init-admin">初始化管理员账号</RouterLink>
          </div>
        </el-form>
      </el-card>
    </section>
  </main>
</template>
