/**
 * feedback — 反馈封装（uni.showToast / uni.showModal / uni.showLoading）
 * 统一 Promise 化，页面禁止直用 uni.showToast 等原生 API。
 */

export type ToastIcon = 'success' | 'error' | 'loading' | 'none'

/**
 * 轻提示（Promise 化 uni.showToast）
 * @param title 提示内容
 * @param icon 图标：success | error | loading | none（默认 none）
 * @param duration 展示时长 ms
 */
export function showToast(title: string, icon: ToastIcon = 'none', duration = 2000): Promise<void> {
  return new Promise((resolve) => {
    uni.showToast({
      title,
      icon: icon as any,
      duration,
      success: () => resolve(),
      fail: () => resolve()
    })
  })
}

export interface ModalOptions {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

/**
 * 确认弹窗（Promise 化 uni.showModal），resolve 布尔（confirm 是否点击确定）
 */
export function showModal(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title || '提示',
      content: options.content,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      showCancel: options.showCancel !== false,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
}

export interface InputModalOptions {
  title?: string
  content?: string
  placeholderText?: string
  confirmText?: string
}

/**
 * 可输入弹窗（uni.showModal editable），用于扫码失败后的手动输入兜底。
 * resolve { confirm, content }：confirm 是否确定；content 为输入内容（取消时为空串）
 */
export function showInputModal(options: InputModalOptions): Promise<{ confirm: boolean; content: string }> {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title || '手动输入',
      content: options.content || '',
      placeholderText: options.placeholderText || '请输入编码',
      confirmText: options.confirmText || '确定',
      editable: true,
      success: (res: any) => {
        const content = res?.content || ''
        resolve({ confirm: !!res?.confirm, content: String(content).trim() })
      },
      fail: () => resolve({ confirm: false, content: '' })
    } as any)
  })
}

/** 全局 Loading */
export function showLoading(title = '加载中...'): void {
  uni.showLoading({ title, mask: true })
}

/** 隐藏全局 Loading */
export function hideLoading(): void {
  uni.hideLoading()
}
