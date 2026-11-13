import type { AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import request, { get, isApiRequestError, normalizeApiBaseURL } from '@/api/request'

const originalAdapter = request.defaults.adapter

describe('normalizeApiBaseURL', () => {
  it.each([
    ['', ''],
    ['https://backend.example.test', 'https://backend.example.test'],
    ['https://api.example.test', 'https://api.example.test'],
    ['/api', ''],
    ['/backend/api', '/backend'],
    ['https://backend.example.test/api/', 'https://backend.example.test'],
  ])('normalizes %s to %s', (baseURL, expected) => {
    expect(normalizeApiBaseURL(baseURL)).toBe(expected)
  })
})

function resolveWith(data: unknown, status = 200) {
  request.defaults.adapter = vi.fn(async (config) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  }))
}

function rejectWith(data: unknown, status: number) {
  request.defaults.adapter = vi.fn(async (config) => {
    throw {
      message: `HTTP ${status}`,
      response: {
        data,
        status,
        statusText: 'Error',
        headers: {},
        config,
      },
    }
  })
}

describe('request error and Blob handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    request.defaults.adapter = originalAdapter
  })

  it('preserves the complete backend message for non-404 business errors', async () => {
    const errorMessage = '关联资源不可见，需要一起转交或先解除绑定（明细：channel-7）'
    resolveWith({ code: 409001, msg: errorMessage, data: { resource: 'channel-7' } })
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get('/api/example').catch((reason: unknown) => reason)

    expect(isApiRequestError(error)).toBe(true)
    expect(error).toMatchObject({ code: 409001, message: errorMessage })
    expect(messageSpy).toHaveBeenCalledWith(errorMessage)
  })

  it('preserves the service capability validation message for code 400001', async () => {
    const errorMessage = 'Target plugin does not support service calls'
    resolveWith({ code: 400001, msg: errorMessage, data: null })
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get('/api/plugin-service/permissions').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ code: 400001, message: errorMessage })
    expect(messageSpy).toHaveBeenCalledWith(errorMessage)
  })

  it('masks both the UI message and rejected error for code 404001', async () => {
    resolveWith({ code: 404001, msg: '秘密资源存在但你越权了', data: null })
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get('/api/secret').catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      code: 404001,
      message: '资源不存在或无权访问',
    })
    expect(messageSpy).toHaveBeenCalledWith('资源不存在或无权访问')
    expect(messageSpy).not.toHaveBeenCalledWith('秘密资源存在但你越权了')
  })

  it('masks both the UI message and rejected error for code 404', async () => {
    resolveWith({ code: 404, msg: '该资源存在，但不属于当前数据范围', data: null })
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get('/api/scoped-resource').catch((reason: unknown) => reason)

    expect(error).toMatchObject({ code: 404, message: '资源不存在或无权访问' })
    expect(messageSpy).toHaveBeenCalledWith('资源不存在或无权访问')
    expect(messageSpy).not.toHaveBeenCalledWith('该资源存在，但不属于当前数据范围')
  })

  it('preserves and displays the backend 403 message', async () => {
    window.history.replaceState({}, '', '/403')
    resolveWith({ code: 403001, msg: 'Forbidden', data: null }, 403)
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get(
      '/api/plugins/installations/installation-a/notification-channels',
    ).catch((reason: unknown) => reason)

    expect(error).toMatchObject({ code: 403001, status: 403, message: 'Forbidden' })
    expect(messageSpy).toHaveBeenCalledWith('Forbidden')
  })

  it('parses a JSON error envelope returned as Blob and preserves non-404 msg', async () => {
    const backendMessage = '导出数量超过上限，请缩小筛选范围'
    rejectWith(
      new Blob([JSON.stringify({ code: 400001, msg: backendMessage, data: null })], {
        type: 'application/json',
      }),
      400,
    )

    const error = await get('/api/export', { responseType: 'blob' }).catch(
      (reason: unknown) => reason,
    )

    expect(error).toMatchObject({ code: 400001, status: 400, message: backendMessage })
  })

  it('masks an HTTP 404 even when its Blob body contains a revealing message', async () => {
    rejectWith(
      new Blob([JSON.stringify({ code: 404001, msg: '越权细节', data: null })], {
        type: 'application/json',
      }),
      404,
    )

    const error = await get('/api/export', { responseType: 'blob' }).catch(
      (reason: unknown) => reason,
    )

    expect(error).toMatchObject({ status: 404, message: '资源不存在或无权访问' })
  })

  it('masks code 404 parsed from a Blob even when the HTTP status is not 404', async () => {
    rejectWith(
      new Blob([JSON.stringify({ code: 404, msg: '二进制导出暴露了越权细节', data: null })], {
        type: 'application/json',
      }),
      400,
    )
    const messageSpy = vi.spyOn(ElMessage, 'error')

    const error = await get('/api/export', { responseType: 'blob' }).catch(
      (reason: unknown) => reason,
    )

    expect(error).toMatchObject({ code: 404, status: 400, message: '资源不存在或无权访问' })
    expect(messageSpy).toHaveBeenCalledWith('资源不存在或无权访问')
    expect(messageSpy).not.toHaveBeenCalledWith('二进制导出暴露了越权细节')
  })

  it('returns a successful binary export as the original Blob', async () => {
    const blob = new Blob(['id,name\n1,demo'], { type: 'text/csv' })
    resolveWith(blob)

    const result = await get<Blob>('/api/export', {
      responseType: 'blob',
    } satisfies AxiosRequestConfig)

    expect(result).toBe(blob)
  })
})
