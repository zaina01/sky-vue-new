import { reactive, ref } from 'vue'

import type { PageQuery, PageResponse } from '@/types/common'

export function usePagination<T, Q extends Record<string, unknown>>(
  initialQuery: Q,
  fetcher: (params: Q & PageQuery) => Promise<PageResponse<T>>,
) {
  const query = reactive({ ...initialQuery }) as Q
  const items = ref<T[]>([])
  const loading = ref(false)
  const page = ref(1)
  const size = ref(10)
  const total = ref(0)
  let loadSequence = 0

  async function load() {
    const sequence = ++loadSequence
    loading.value = true
    try {
      const response = await fetcher({ ...query, page: page.value, size: size.value })
      if (sequence !== loadSequence) return
      items.value = response.items
      page.value = response.page
      size.value = response.size
      total.value = response.total
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  function reset() {
    Object.assign(query, initialQuery)
    page.value = 1
    return load()
  }

  function changePage(value: number) {
    page.value = value
    return load()
  }

  function changeSize(value: number) {
    size.value = value
    page.value = 1
    return load()
  }

  return {
    query,
    items,
    loading,
    page,
    size,
    total,
    load,
    reset,
    changePage,
    changeSize,
  }
}
