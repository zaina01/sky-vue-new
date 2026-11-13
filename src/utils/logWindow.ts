export const LOG_WINDOW_MAX_BYTES = 2 * 1024 * 1024
const LOG_WINDOW_SEGMENT_TARGET_BYTES = 64 * 1024

export type LogWindowMergeMode = 'replace' | 'prepend' | 'append'

export interface LogWindowChunk {
  content: string
  offset: number
  nextOffset: number
}

export interface LogWindowSegment extends LogWindowChunk {
  key: string
}

export interface LogWindowState {
  segments: LogWindowSegment[]
  startOffset: number
  nextOffset: number
}

export function createEmptyLogWindow(): LogWindowState {
  return {
    segments: [],
    startOffset: 0,
    nextOffset: 0,
  }
}

export function mergeLogWindowChunk(
  current: LogWindowState,
  chunk: LogWindowChunk,
  mode: LogWindowMergeMode,
  maxBytes = LOG_WINDOW_MAX_BYTES,
): LogWindowState {
  if (mode === 'replace') return createWindowFromChunk(chunk)

  const segments = [...current.segments]
  const segment = createNonOverlappingSegment(current, chunk, mode)
  if (!segment) return current

  if (mode === 'prepend') segments.unshift(segment)
  else appendSegment(segments, segment, maxBytes)

  trimWindow(segments, mode, maxBytes)
  return createWindowFromSegments(segments, chunk)
}

export function getLogWindowContent(window: LogWindowState) {
  return window.segments.map((segment) => segment.content).join('')
}

export function getLogWindowByteSize(window: LogWindowState) {
  return Math.max(0, window.nextOffset - window.startOffset)
}

function createWindowFromChunk(chunk: LogWindowChunk): LogWindowState {
  if (chunk.nextOffset <= chunk.offset) {
    return {
      segments: [],
      startOffset: chunk.offset,
      nextOffset: chunk.nextOffset,
    }
  }

  const segment = createSegment(chunk.content, chunk.offset, chunk.nextOffset)
  return createWindowFromSegments([segment], chunk)
}

function createWindowFromSegments(
  segments: LogWindowSegment[],
  fallback: Pick<LogWindowChunk, 'offset' | 'nextOffset'>,
): LogWindowState {
  return {
    segments,
    startOffset: segments[0]?.offset ?? fallback.offset,
    nextOffset: segments.at(-1)?.nextOffset ?? fallback.nextOffset,
  }
}

function createNonOverlappingSegment(
  current: LogWindowState,
  chunk: LogWindowChunk,
  mode: Exclude<LogWindowMergeMode, 'replace'>,
) {
  if (chunk.nextOffset <= chunk.offset) return undefined

  if (mode === 'append') {
    if (chunk.nextOffset <= current.nextOffset) return undefined

    const offset = Math.max(chunk.offset, current.nextOffset)
    const skippedBytes = offset - chunk.offset
    const content = skippedBytes > 0 ? sliceUtf8(chunk.content, skippedBytes) : chunk.content
    return createSegment(content, offset, chunk.nextOffset)
  }

  if (chunk.offset >= current.startOffset) return undefined

  const nextOffset = Math.min(chunk.nextOffset, current.startOffset)
  const retainedBytes = nextOffset - chunk.offset
  const content =
    nextOffset < chunk.nextOffset ? sliceUtf8(chunk.content, 0, retainedBytes) : chunk.content
  return createSegment(content, chunk.offset, nextOffset)
}

function createSegment(content: string, offset: number, nextOffset: number): LogWindowSegment {
  return {
    content,
    offset,
    nextOffset,
    key: `${offset}:${nextOffset}`,
  }
}

function appendSegment(segments: LogWindowSegment[], segment: LogWindowSegment, maxBytes: number) {
  const previous = segments.at(-1)
  const segmentTargetBytes = Math.min(
    LOG_WINDOW_SEGMENT_TARGET_BYTES,
    Math.max(1, Math.floor(maxBytes / 2)),
  )
  if (
    previous &&
    previous.nextOffset === segment.offset &&
    segment.nextOffset - previous.offset <= segmentTargetBytes
  ) {
    segments[segments.length - 1] = createSegment(
      previous.content + segment.content,
      previous.offset,
      segment.nextOffset,
    )
    return
  }

  segments.push(segment)
}

function trimWindow(
  segments: LogWindowSegment[],
  mode: Exclude<LogWindowMergeMode, 'replace'>,
  maxBytes: number,
) {
  while (segments.length > 1 && windowSpan(segments) > maxBytes) {
    if (mode === 'prepend') segments.pop()
    else segments.shift()
  }
}

function windowSpan(segments: LogWindowSegment[]) {
  const startOffset = segments[0]?.offset ?? 0
  const nextOffset = segments.at(-1)?.nextOffset ?? startOffset
  return Math.max(0, nextOffset - startOffset)
}

function sliceUtf8(content: string, start: number, end?: number) {
  const bytes = new TextEncoder().encode(content)
  return new TextDecoder().decode(bytes.slice(start, end))
}
