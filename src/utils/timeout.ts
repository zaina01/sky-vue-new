export type TimeoutUnit = 'MILLISECOND' | 'SECOND' | 'MINUTE' | 'HOUR'

export interface TimeoutUnitOption {
  label: string
  value: TimeoutUnit
  multiplier: number
  precision: number
}

export const timeoutUnitOptions: TimeoutUnitOption[] = [
  { label: '毫秒', value: 'MILLISECOND', multiplier: 1, precision: 0 },
  { label: '秒', value: 'SECOND', multiplier: 1000, precision: 3 },
  { label: '分钟', value: 'MINUTE', multiplier: 60_000, precision: 6 },
  { label: '小时', value: 'HOUR', multiplier: 3_600_000, precision: 7 },
]

export function bestTimeoutUnit(value: number): TimeoutUnit {
  return (
    [...timeoutUnitOptions].reverse().find((option) => value % option.multiplier === 0)?.value ||
    'MILLISECOND'
  )
}
