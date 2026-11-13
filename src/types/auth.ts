export type PermissionName = string

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: CurrentUser
  expiresIn: number
  permissions: string[]
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
  phone?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  success: boolean
}

export interface CurrentUser {
  userId: string
  username: string
  email: string
  phone?: string | null
  avatar?: string | null
  departmentId: number | null
  departmentName: string | null
  registerTime: string
  roles: PermissionName[]
  permissions: PermissionName[]
}
