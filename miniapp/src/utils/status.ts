/**
 * 状态映射工具（小程序端）
 * 将后端 status 枚举转为中文标签 + 颜色（对齐 mobile-frontend style.css status-*）。
 */

export interface StatusMeta {
  label: string
  /** 文字色 */
  color: string
  /** 背景色 */
  bg: string
}

const TOOL_MAP: Record<string, StatusMeta> = {
  available: { label: '可用', color: '#07c160', bg: '#e8f8ef' },
  borrowed: { label: '借出', color: '#ff976a', bg: '#fff3e0' },
  maintenance: { label: '维修中', color: '#1989fa', bg: '#e8f3ff' },
  scrapped: { label: '报废', color: '#999999', bg: '#f2f3f5' }
}

const ORDER_MAP: Record<string, StatusMeta> = {
  pending: { label: '待审批', color: '#f9a825', bg: '#fff8e1' },
  approved: { label: '已批准', color: '#07c160', bg: '#e8f8ef' },
  borrowed: { label: '借出中', color: '#ff976a', bg: '#fff3e0' },
  returned: { label: '已归还', color: '#666666', bg: '#f2f3f5' },
  rejected: { label: '已拒绝', color: '#ee0a24', bg: '#ffebee' },
  cancelled: { label: '已取消', color: '#999999', bg: '#f2f3f5' }
}

const FALLBACK: StatusMeta = { label: '未知', color: '#999999', bg: '#f2f3f5' }

export function toolStatusMeta(status?: string): StatusMeta {
  if (!status) return FALLBACK
  return TOOL_MAP[status] || FALLBACK
}

export function orderStatusMeta(status?: string): StatusMeta {
  if (!status) return FALLBACK
  return ORDER_MAP[status] || FALLBACK
}

/** 将后端任意响应规整为数组（兼容裸数组 / {list} / {data}） */
export function toArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  if (data && Array.isArray(data.data)) return data.data
  return []
}
