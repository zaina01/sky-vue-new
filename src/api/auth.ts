import { get, post } from './request'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '@/types/auth'

export function login(data: LoginRequest) {
  return post<LoginResponse, LoginRequest>('/api/user/login', data)
}

export function register(data: RegisterRequest) {
  return post<CurrentUser, RegisterRequest>('/api/user/register', data)
}

export function getCurrentUser() {
  return get<CurrentUser>('/api/user/me')
}

export function changePassword(data: ChangePasswordRequest) {
  return post<ChangePasswordResponse, ChangePasswordRequest>('/api/user/change-password', data)
}
