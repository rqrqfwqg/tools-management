// 微信订阅消息模板 ID 配置
// 优先读 Vite 环境变量（构建期注入，见 .env.production / .env.development 的 VITE_WX_TPL_*），
// 未配置时回落为空字符串——此时前端不会发起授权请求（需先在公众平台创建模板并填 ID）。
export const WX_TPL_CLAIM: string = (import.meta.env.VITE_WX_TPL_CLAIM as string) || ''
export const WX_TPL_REMIND: string = (import.meta.env.VITE_WX_TPL_REMIND as string) || ''

export function hasWxTemplates(): boolean {
  return !!(WX_TPL_CLAIM || WX_TPL_REMIND)
}
