<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import type { ComponentSize } from 'element-plus'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    fallback: RouteLocationRaw
    label?: string
    replaceOnFallback?: boolean
    size?: ComponentSize
  }>(),
  {
    label: '返回',
    replaceOnFallback: true,
    size: 'default',
  },
)

const route = useRoute()
const router = useRouter()

function getSafeBackTarget() {
  const previous = window.history.state?.back
  if (typeof previous !== 'string' || !previous || previous === route.fullPath) return undefined

  const resolved = router.resolve(previous)
  if (!resolved.matched.length || resolved.meta.public) return undefined

  return previous
}

async function navigateBack() {
  if (getSafeBackTarget()) {
    router.back()
    return
  }

  if (props.replaceOnFallback) {
    await router.replace(props.fallback)
    return
  }

  await router.push(props.fallback)
}
</script>

<template>
  <el-button :icon="ArrowLeft" :size="size" @click="navigateBack">
    {{ label }}
  </el-button>
</template>
