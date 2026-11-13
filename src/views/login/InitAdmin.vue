<script setup lang="ts">
import { Lock, Message, Phone, User } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { register } from '@/api/auth'
import type { RegisterRequest } from '@/types/auth'

interface InitAdminForm extends RegisterRequest {
  confirmPassword: string
}

interface RequestError {
  code?: number
  message?: string
}

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const initialized = ref(false)
const form = reactive<InitAdminForm>({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  phone: '',
})

const rules: FormRules<InitAdminForm> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入合法邮箱', trigger: 'blur' },
  ],
}

function clearPasswords() {
  form.password = ''
  form.confirmPassword = ''
}

function isAlreadyInitialized(error: unknown) {
  const requestError = error as RequestError
  return (
    requestError.code === 409001 ||
    /只能注册一个|已有用户|已存在用户|已经.*初始化|已完成初始化/.test(requestError.message || '')
  )
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await register({
      username: form.username,
      password: form.password,
      email: form.email,
      phone: form.phone || undefined,
    })
    ElMessage.success('管理员账号初始化成功，请登录')
    router.replace('/login')
  } catch (error) {
    if (isAlreadyInitialized(error)) {
      initialized.value = true
      ElMessage.warning('系统已完成初始化，请直接登录')
    }
  } finally {
    loading.value = false
    clearPasswords()
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-panel__intro">
        <p class="eyebrow">First Deployment</p>
        <h1>初始化管理员账号</h1>
        <p>
          该页面仅用于系统首次部署时创建第一个管理员账号。创建成功后，该账号会自动获得 ADMIN
          角色。系统已有用户后将无法再次初始化。
        </p>
      </div>

      <el-card class="login-card" shadow="never">
        <h2>创建第一个管理员账号</h2>
        <el-alert
          v-if="initialized"
          title="系统已完成初始化，请直接登录。"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 18px"
        />
        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="submit">
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              placeholder="用户名"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item prop="email">
            <el-input v-model="form.email" :prefix-icon="Message" placeholder="邮箱" />
          </el-form-item>
          <el-form-item prop="phone">
            <el-input v-model="form.phone" :prefix-icon="Phone" placeholder="手机号（可选）" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              placeholder="密码"
              autocomplete="new-password"
              show-password
            />
          </el-form-item>
          <el-form-item prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              :prefix-icon="Lock"
              type="password"
              placeholder="确认密码"
              autocomplete="new-password"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button type="primary" class="login-card__submit" :loading="loading" @click="submit">
            初始化管理员
          </el-button>
          <el-button class="login-card__link" link @click="router.push('/login')">
            返回登录
          </el-button>
        </el-form>
      </el-card>
    </section>
  </main>
</template>
