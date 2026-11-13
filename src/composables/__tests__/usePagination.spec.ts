import { describe, expect, it, vi } from 'vitest'

import { usePagination } from '@/composables/usePagination'
import type { PageResponse } from '@/types/common'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('usePagination', () => {
  it('uses backend items, page, size, and total without client correction', async () => {
    const response: PageResponse<{ id: number }> = {
      items: [{ id: 99 }],
      page: 4,
      size: 25,
      total: 987,
    }
    const fetcher = vi.fn().mockResolvedValue(response)
    const table = usePagination({ departmentId: 7 }, fetcher)
    table.page.value = 4
    table.size.value = 25

    await table.load()

    expect(fetcher).toHaveBeenCalledWith({ departmentId: 7, page: 4, size: 25 })
    expect(table.items.value).toEqual(response.items)
    expect(table.page.value).toBe(4)
    expect(table.size.value).toBe(25)
    expect(table.total.value).toBe(987)
  })

  it('does not let an older asynchronous response overwrite a newer query', async () => {
    const first = deferred<PageResponse<string>>()
    const second = deferred<PageResponse<string>>()
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const table = usePagination({ keyword: 'first' }, fetcher)

    const firstLoad = table.load()
    table.query.keyword = 'second'
    const secondLoad = table.load()
    second.resolve({ items: ['new'], page: 1, size: 10, total: 1 })
    await secondLoad
    first.resolve({ items: ['stale'], page: 1, size: 10, total: 500 })
    await firstLoad

    expect(table.items.value).toEqual(['new'])
    expect(table.total.value).toBe(1)
  })
})
