<script setup lang="ts">
import type { TableInstance } from 'element-plus'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  loading: boolean
  total: number
  page: number
  size: number
}>()

const emit = defineEmits<{
  pageChange: [value: number]
  sizeChange: [value: number]
}>()

const containerRef = ref<HTMLElement>()
const tableRef = ref<TableInstance>()
let resizeObserver: ResizeObserver | undefined
let observedWidth: number | undefined
let layoutPending = false
let stopped = false

async function scheduleTableLayout() {
  if (layoutPending) return
  layoutPending = true
  await nextTick()
  layoutPending = false
  if (!stopped) tableRef.value?.doLayout()
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function toggleRowSelection(row: unknown, selected?: boolean) {
  tableRef.value?.toggleRowSelection(row, selected)
}

defineExpose({ clearSelection, toggleRowSelection })

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  observedWidth = Math.round(container.getBoundingClientRect().width)
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    const width = Math.round(entry.contentRect.width)
    if (width === observedWidth) return
    observedWidth = width
    void scheduleTableLayout()
  })
  resizeObserver.observe(container)
})

onBeforeUnmount(() => {
  stopped = true
  resizeObserver?.disconnect()
  resizeObserver = undefined
})
</script>

<template>
  <div ref="containerRef" class="pagination-table">
    <el-table ref="tableRef" v-loading="loading" flexible v-bind="$attrs">
      <slot />
    </el-table>
    <footer class="pagination-table__footer">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :current-page="page"
        :page-size="size"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="emit('pageChange', $event)"
        @size-change="emit('sizeChange', $event)"
      />
    </footer>
  </div>
</template>

<style scoped>
.pagination-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
</style>
