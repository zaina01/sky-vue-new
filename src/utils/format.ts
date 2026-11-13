type DateValue = string | number | Date | null | undefined

function normalizeDateValue(value: Exclude<DateValue, null | undefined>, timeOnly = false) {
  if (value instanceof Date || typeof value === 'number') return new Date(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`)
  if (timeOnly && /^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    return new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}`)
  }
  return new Date(value)
}

function formatWithOptions(
  value: DateValue,
  options: Intl.DateTimeFormatOptions,
  timeOnly = false,
) {
  if (value === undefined || value === null || value === '') return '-'
  const date = normalizeDateValue(value, timeOnly)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', options).format(date)
}

export function formatDate(value: DateValue) {
  return formatWithOptions(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatTime(value: DateValue) {
  return formatWithOptions(
    value,
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    },
    true,
  )
}

export function formatDateTime(value: DateValue) {
  return formatWithOptions(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatDuration(milliseconds?: number) {
  if (milliseconds === undefined || milliseconds === null) return '-'
  if (milliseconds < 1000) return `${milliseconds}ms`
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return `${minutes}m ${restSeconds}s`
}

export function maskSensitiveValue(value?: string) {
  if (!value) return ''
  if (value.length <= 8) return '******'
  return `${value.slice(0, 4)}******${value.slice(-4)}`
}
