import { ElMessage, ElMessageBox } from 'element-plus'

export async function useConfirmAction(options: {
  title: string
  message: string
  confirmText?: string
  successMessage?: string
  action: () => Promise<unknown>
}) {
  await ElMessageBox.confirm(options.message, options.title, {
    type: 'warning',
    confirmButtonText: options.confirmText || '确认执行',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })

  await options.action()

  if (options.successMessage) {
    ElMessage.success(options.successMessage)
  }
}
