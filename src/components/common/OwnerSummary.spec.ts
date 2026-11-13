import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OwnerSummary from '@/components/common/OwnerSummary.vue'

describe('OwnerSummary', () => {
  it('renders historical IDs directly when names are unavailable', () => {
    const wrapper = mount(OwnerSummary, {
      props: { ownerUserId: 'deleted-user', ownerDepartmentId: 42 },
    })

    expect(wrapper.text()).toContain('用户 deleted-user')
    expect(wrapper.text()).toContain('部门 42')
  })

  it('prefers response snapshot names without querying current entities', () => {
    const wrapper = mount(OwnerSummary, {
      props: {
        ownerUserId: 'user-1',
        ownerUsername: '历史用户名',
        ownerDepartmentId: 1,
        ownerDepartmentName: '历史部门',
      },
    })

    expect(wrapper.text()).toContain('历史用户名')
    expect(wrapper.text()).toContain('历史部门')
    expect(wrapper.text()).not.toContain('用户 user-1')
  })
})
