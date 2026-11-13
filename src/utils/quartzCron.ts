export interface QuartzCronParts {
  second: string
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
  year?: string
}

export function splitQuartzCron(expression: string): QuartzCronParts | null {
  const segments = expression.trim().split(/\s+/).filter(Boolean)
  if (segments.length !== 6 && segments.length !== 7) return null

  return {
    second: segments[0],
    minute: segments[1],
    hour: segments[2],
    dayOfMonth: segments[3],
    month: segments[4],
    dayOfWeek: segments[5],
    year: segments[6],
  }
}

export function joinQuartzCron(parts: QuartzCronParts) {
  return [
    parts.second,
    parts.minute,
    parts.hour,
    parts.dayOfMonth,
    parts.month,
    parts.dayOfWeek,
    parts.year,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
}

export function isQuartzCronSegmentCount(expression: string) {
  const count = expression.trim().split(/\s+/).filter(Boolean).length
  return count === 6 || count === 7
}
