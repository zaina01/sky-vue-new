import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useResourceStore } from '@/stores/resource'

describe('resource revision invalidation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('bumps every scoped list, detail, option, and notification domain after ownership changes', () => {
    const store = useResourceStore()

    store.invalidateScopedData()

    expect(store.revisions).toMatchObject({
      users: 1,
      pluginInstallations: 1,
      pluginConfig: 1,
      pluginAccounts: 1,
      jobs: 1,
      executions: 1,
      notificationChannels: 1,
      notificationRules: 1,
      notificationHistory: 1,
      pluginAudit: 1,
      pluginService: 1,
    })
    expect(store.revisions.pluginDefinitions).toBe(0)
  })
})
