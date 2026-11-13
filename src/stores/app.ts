import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const loadingCount = ref(0)

  const globalLoading = computed(() => loadingCount.value > 0)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function startLoading() {
    loadingCount.value += 1
  }

  function finishLoading() {
    loadingCount.value = Math.max(0, loadingCount.value - 1)
  }

  return {
    sidebarCollapsed,
    globalLoading,
    toggleSidebar,
    startLoading,
    finishLoading,
  }
})
