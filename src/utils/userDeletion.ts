import { isApiRequestError, type ApiRequestError } from '@/api/request'

export function isUserDeleteConflict(error: unknown): error is ApiRequestError {
  return isApiRequestError(error) && (error.code === 409001 || error.status === 409)
}
