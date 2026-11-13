import { defineStore } from 'pinia'
import { reactive } from 'vue'

export type ResourceDomain =
  | 'departments'
  | 'users'
  | 'roles'
  | 'pluginDefinitions'
  | 'pluginInstallations'
  | 'pluginConfig'
  | 'pluginAccounts'
  | 'jobs'
  | 'executions'
  | 'notificationChannels'
  | 'notificationRules'
  | 'notificationHistory'
  | 'pluginAudit'
  | 'pluginService'

const scopedDomains: ResourceDomain[] = [
  'users',
  'pluginInstallations',
  'pluginConfig',
  'pluginAccounts',
  'jobs',
  'executions',
  'notificationChannels',
  'notificationRules',
  'notificationHistory',
  'pluginAudit',
  'pluginService',
]

export const useResourceStore = defineStore('resource', () => {
  const revisions = reactive<Record<ResourceDomain, number>>({
    departments: 0,
    users: 0,
    roles: 0,
    pluginDefinitions: 0,
    pluginInstallations: 0,
    pluginConfig: 0,
    pluginAccounts: 0,
    jobs: 0,
    executions: 0,
    notificationChannels: 0,
    notificationRules: 0,
    notificationHistory: 0,
    pluginAudit: 0,
    pluginService: 0,
  })

  function invalidate(...domains: ResourceDomain[]) {
    for (const domain of new Set(domains)) revisions[domain] += 1
  }

  function invalidateScopedData() {
    invalidate(...scopedDomains)
  }

  return { revisions, invalidate, invalidateScopedData }
})
