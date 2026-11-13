import type { ID } from '@/types/common'

export function pluginAccountIdentity(installationId: string, accountId: ID | string) {
  return `${installationId}:${String(accountId)}`
}

export function pluginAccountPreferenceKey(
  prefix: string,
  installationId: string,
  accountId: ID | string,
) {
  return `${prefix}${encodeURIComponent(installationId)}:${encodeURIComponent(String(accountId))}`
}
