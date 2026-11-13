import { describe, expect, it } from 'vitest'

import {
  createEmptyLogWindow,
  getLogWindowByteSize,
  getLogWindowContent,
  LOG_WINDOW_MAX_BYTES,
  mergeLogWindowChunk,
} from '@/utils/logWindow'

function chunk(content: string, offset: number, nextOffset: number) {
  return { content, offset, nextOffset }
}

describe('logWindow', () => {
  it('keeps the newest segments when appending beyond the byte limit', () => {
    let window = mergeLogWindowChunk(createEmptyLogWindow(), chunk('aaaa', 0, 4), 'replace', 8)
    window = mergeLogWindowChunk(window, chunk('bbbb', 4, 8), 'append', 8)
    window = mergeLogWindowChunk(window, chunk('cccc', 8, 12), 'append', 8)

    expect(getLogWindowContent(window)).toBe('bbbbcccc')
    expect(getLogWindowByteSize(window)).toBe(8)
    expect(window.startOffset).toBe(4)
    expect(window.nextOffset).toBe(12)
  })

  it('keeps the earliest segments when prepending beyond the byte limit', () => {
    let window = mergeLogWindowChunk(createEmptyLogWindow(), chunk('cccc', 8, 12), 'replace', 8)
    window = mergeLogWindowChunk(window, chunk('bbbb', 4, 8), 'prepend', 8)
    window = mergeLogWindowChunk(window, chunk('aaaa', 0, 4), 'prepend', 8)

    expect(getLogWindowContent(window)).toBe('aaaabbbb')
    expect(getLogWindowByteSize(window)).toBe(8)
    expect(window.startOffset).toBe(0)
    expect(window.nextOffset).toBe(8)
  })

  it('ignores duplicate ranges and retains only the non-overlapping bytes', () => {
    let window = mergeLogWindowChunk(createEmptyLogWindow(), chunk('abcdefgh', 0, 8), 'replace')
    const unchanged = mergeLogWindowChunk(window, chunk('efgh', 4, 8), 'append')
    expect(unchanged).toBe(window)

    window = mergeLogWindowChunk(window, chunk('ghij', 6, 10), 'append')
    expect(getLogWindowContent(window)).toBe('abcdefghij')
    expect(window.segments).toHaveLength(1)
    expect(window.nextOffset).toBe(10)
  })

  it('resets the window on replacement and does not add zero-length segments', () => {
    let window = mergeLogWindowChunk(createEmptyLogWindow(), chunk('old', 0, 3), 'replace')
    window = mergeLogWindowChunk(window, chunk('tail', 20, 24), 'replace')
    const unchanged = mergeLogWindowChunk(window, chunk('', 24, 24), 'append')

    expect(unchanged).toBe(window)
    expect(getLogWindowContent(window)).toBe('tail')
    expect(window.startOffset).toBe(20)
    expect(window.nextOffset).toBe(24)
  })

  it('coalesces small live updates instead of creating an unbounded number of DOM segments', () => {
    let window = mergeLogWindowChunk(createEmptyLogWindow(), chunk('a', 0, 1), 'replace')

    for (let offset = 1; offset < 100; offset += 1) {
      window = mergeLogWindowChunk(window, chunk('a', offset, offset + 1), 'append')
    }

    expect(window.segments).toHaveLength(1)
    expect(getLogWindowContent(window)).toHaveLength(100)
  })

  it('uses a fixed 2 MiB production window limit', () => {
    expect(LOG_WINDOW_MAX_BYTES).toBe(2 * 1024 * 1024)
  })
})
