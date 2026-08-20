/**
 * 图片 URL 工具
 * 后端 image_url 存的是相对路径（如 /uploads/tool_1_xxx.jpg），
 * 小程序 <image> 需要完整 URL，这里按 BASE_URL 的 origin 补全。
 */
import { BASE_URL } from '@/utils/request'

/** 后端 API 的 origin（由 VITE_API_BASE_URL 决定，生产为 https://www.xmgl-123.cn） */
const ORIGIN = BASE_URL.replace(/\/api\/?$/, '')

/**
 * 把后端的相对/绝对图片地址解析为小程序可用的完整 URL。
 * @param url 后端 image_url 字段
 * @returns 完整 URL；空值返回空串
 */
export function resolveImage(url?: string): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  if (/^data:/.test(url)) return url
  return ORIGIN + (url.startsWith('/') ? url : `/${url}`)
}
