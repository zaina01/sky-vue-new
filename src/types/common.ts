export type ID = string | number

export interface PageQuery {
  page: number
  size: number
}

export interface ApiResponse<T> {
  code: number
  msg: string
  data: T | null
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  total: number
}

export interface ApiErrorPayload {
  code?: number
  message: string
  data?: unknown
  status?: number
}

export interface OptionItem<T = string> {
  label: string
  value: T
}

export type EnabledStatus = 'ENABLED' | 'DISABLED'

export type DateRange = [string, string]
