import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

import { useAppStore } from '@/stores/app'
import type { ApiResponse } from '@/types/common'
import { clearToken, getToken } from '@/utils/token'

export interface ApiRequestError<T = unknown> {
  code?: number
  status?: number
  message: string
  data?: T | null
  response?: AxiosResponse<ApiResponse<T> | Blob>
  raw?: unknown
}

const publicUrls = ['/api/user/login', '/api/user/register']
const inaccessibleResourceMessage = '资源不存在或无权访问'

export function normalizeApiBaseURL(baseURL: string) {
  return baseURL.replace(/\/api\/?$/, '')
}

const request = axios.create({
  baseURL: normalizeApiBaseURL(import.meta.env.VITE_API_BASE_URL || ''),
  timeout: 15000,
})

let unauthorizedRedirecting = false

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return Boolean(
    value && typeof value === 'object' && typeof (value as ApiResponse<unknown>).code === 'number',
  )
}

function isNotFoundError(code?: number, status?: number) {
  return code === 404 || code === 404001 || status === 404
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return Boolean(
    value && typeof value === 'object' && typeof (value as ApiRequestError).message === 'string',
  )
}

async function readApiResponse(value: unknown): Promise<ApiResponse<unknown> | undefined> {
  if (isApiResponse(value)) return value
  if (!(value instanceof Blob)) return undefined

  try {
    const parsed = JSON.parse(await value.text()) as unknown
    return isApiResponse(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function redirectToLogin() {
  if (unauthorizedRedirecting) return
  unauthorizedRedirecting = true
  clearToken()
  const current = `${window.location.pathname}${window.location.search}`
  const redirect = current.startsWith('/login') ? '' : `?redirect=${encodeURIComponent(current)}`
  window.location.assign(`/login${redirect}`)
}

function redirectToForbidden() {
  if (!window.location.pathname.startsWith('/403')) {
    window.location.assign('/403')
  }
}

function shouldHandleLocally(error: ApiRequestError) {
  const url = error.response?.config.url || ''
  const method = error.response?.config.method?.toLowerCase()
  return (
    (error.code === 400001 && url.includes('/api/user/login')) ||
    (error.code === 409001 && url.includes('/api/user/register')) ||
    ((error.code === 409001 || error.status === 409) &&
      method === 'delete' &&
      /\/api\/system\/users\/[^/]+$/.test(url))
  )
}

function handleBusinessError(error: ApiRequestError) {
  if (shouldHandleLocally(error)) return

  if (isNotFoundError(error.code, error.status)) {
    ElMessage.error(inaccessibleResourceMessage)
    return
  }

  if (error.code === 401001 || error.code === 401002) {
    ElMessage.error(error.message)
    redirectToLogin()
    return
  }

  if (error.code === 403001) {
    ElMessage.error(error.message || '无权限访问')
    redirectToForbidden()
    return
  }

  ElMessage.error(error.message)
}

request.interceptors.request.use((config) => {
  const token = getToken()
  const url = config.url || ''

  if (token && !publicUrls.some((item) => url.includes(item))) {
    config.headers.Authorization = `Bearer ${token}`
  }

  useAppStore().startLoading()
  return config
})

request.interceptors.response.use(
  (response) => {
    useAppStore().finishLoading()

    const body = response.data as unknown
    if (!isApiResponse(body)) return response.data

    if (body.code === 0) return body.data

    const isNotFound = isNotFoundError(body.code, response.status)
    const error: ApiRequestError = {
      code: body.code,
      status: response.status,
      message: isNotFound ? inaccessibleResourceMessage : body.msg || '请求失败',
      data: body.data,
      response,
    }
    handleBusinessError(error)
    return Promise.reject(error)
  },
  async (error: AxiosError<ApiResponse<unknown> | Blob>) => {
    useAppStore().finishLoading()

    const body = await readApiResponse(error.response?.data)
    const code = body?.code
    const isNotFound = isNotFoundError(code, error.response?.status)
    const requestError: ApiRequestError = {
      code,
      status: error.response?.status,
      message: isNotFound ? inaccessibleResourceMessage : body?.msg || error.message || '请求失败',
      data: body?.data,
      response: error.response,
      raw: error,
    }

    handleBusinessError(requestError)
    return Promise.reject(requestError)
  },
)

export function get<T>(url: string, config?: AxiosRequestConfig) {
  return request.get<T, T>(url, config)
}

export function post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
  return request.post<T, T>(url, data, config)
}

export function put<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
  return request.put<T, T>(url, data, config)
}

export function patch<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
  return request.patch<T, T>(url, data, config)
}

export function del<T, D = unknown>(url: string, config?: AxiosRequestConfig<D>) {
  return request.delete<T, T, D>(url, config)
}

export default request
