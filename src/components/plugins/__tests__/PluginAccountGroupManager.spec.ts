import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPluginAccountGroup,
  deletePluginAccountGroup,
  renamePluginAccountGroup,
} from '@/api/plugins'
import PluginAccountGroupManager from '@/components/plugins/PluginAccountGroupManager.vue'
import { useUserStore } from '@/stores/user'

vi.mock('@/api/plugins', () => ({
  createPluginAccountGroup: vi.fn(),
  deletePluginAccountGroup: vi.fn(),
  renamePluginAccountGroup: vi.fn(),
}))

const group = { groupId: 12, name: '主账户', accountCount: 2, createdAt: '', updatedAt: '' }
function mountManager(write = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().setProfile({
    userId: '1',
    username: 'tester',
    email: '',
    departmentId: null,
    departmentName: null,
    registerTime: '',
    roles: [],
    permissions: write ? ['plugin:account:write'] : ['plugin:account:read'],
  })
  return mount(PluginAccountGroupManager, {
    props: { installationId: 'a', groups: [group], ready: true },
    global: {
      plugins: [pinia],
      stubs: {
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { template: '<div><slot /></div>' },
        ElInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        ElButton: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot /></button>',
        },
        ElTable: { props: ['data'], template: '<div><slot /></div>' },
        ElTableColumn: {
          template: '<div><slot :row="{ groupId: 12, name: \'主账户\', accountCount: 2 }" /></div>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.mocked(createPluginAccountGroup).mockReset().mockResolvedValue(group)
  vi.mocked(renamePluginAccountGroup).mockReset().mockResolvedValue(group)
  vi.mocked(deletePluginAccountGroup).mockReset().mockResolvedValue({ success: true })
})

describe('PluginAccountGroupManager', () => {
  it('trims names and validates empty and oversized values before sending', async () => {
    const wrapper = mountManager()
    const save = wrapper.findAll('button').find((button) => button.text() === '保存分组')!
    await wrapper.get('input').setValue('   ')
    await save.trigger('click')
    expect(createPluginAccountGroup).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('x'.repeat(129))
    await save.trigger('click')
    expect(createPluginAccountGroup).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('  备用  ')
    await save.trigger('click')
    await flushPromises()
    expect(createPluginAccountGroup).toHaveBeenCalledWith('a', '备用')
    expect(wrapper.emitted('changed')).toEqual([[]])
  })

  it('retains a rejected rename draft for correction', async () => {
    vi.mocked(renamePluginAccountGroup).mockRejectedValue({ status: 409, message: 'Duplicate' })
    const wrapper = mountManager()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重命名')!
      .trigger('click')
    await wrapper.get('input').setValue('另一个组')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存分组')!
      .trigger('click')
    await flushPromises()
    expect(renamePluginAccountGroup).toHaveBeenCalledWith('a', 12, '另一个组')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('另一个组')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('confirms deletion of a populated group and reports the deleted ID', async () => {
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never)
    const wrapper = mountManager()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '删除分组')!
      .trigger('click')
    await flushPromises()
    expect(confirm.mock.calls[0]![0]).toContain('2 个账户')
    expect(confirm.mock.calls[0]![0]).toContain('账户将保留并转为未分组')
    expect(deletePluginAccountGroup).toHaveBeenCalledWith('a', 12)
    expect(wrapper.emitted('changed')).toEqual([[12]])
  })

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    const wrapper = mountManager()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '删除分组')!
      .trigger('click')
    await flushPromises()
    expect(deletePluginAccountGroup).not.toHaveBeenCalled()
  })

  it('hides mutation actions for readers', () => {
    const wrapper = mountManager(false)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
