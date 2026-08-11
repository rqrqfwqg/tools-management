/**
 * 调试模式配置
 * 仅开发版/开发者工具（envVersion === 'develop'）生效，正式版不显示调试入口。
 */

/** 调试登录默认管理员手机号（可用 VITE_DEBUG_ADMIN_PHONE 覆盖） */
export const DEBUG_ADMIN_PHONE: string =
  (import.meta.env.VITE_DEBUG_ADMIN_PHONE as string) || '13570383740'

/** 检测当前是否为开发版/调试模式（mp-weixin：envVersion = develop | trial | release） */
export function isDebugMode(): boolean {
  try {
    const wxAny = (globalThis as unknown as Record<string, any>).wx
    const env = wxAny?.getAccountInfoSync?.()?.miniProgram?.envVersion
    return env === 'develop'
  } catch {
    return false
  }
}
