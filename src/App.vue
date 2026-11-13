<script setup lang="ts">
import { RouterView } from 'vue-router'

import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<template>
  <el-config-provider>
    <RouterView />
    <div v-if="appStore.globalLoading" class="global-loading-bar" />
  </el-config-provider>
</template>
