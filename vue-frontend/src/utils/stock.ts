// 库存三态判定唯一入口（PC 端）
// ⚠️ 两端同步：与 mobile-frontend/src/utils/stock.ts 为镜像实现，改一处必须改另一处
// 口径（用户决策 #3）：stock_qty<=0 → out(缺货)；is_low_stock（备件后端字段）或
// warning_qty!=null && stock_qty<=warning_qty（消耗品回退）→ low(需补仓)；否则 normal(正常)。
// 禁止页面内自造口径，统一走本文件。

export type StockStatus = 'normal' | 'low' | 'out'

export interface StockStatusInput {
  stock_qty?: number | null
  warning_qty?: number | null
  /** 备件后端衍生字段；消耗品缺省时回退 warning_qty 判定 */
  is_low_stock?: boolean
}

/**
 * 计算库存三态（纯函数）。
 * @param item 输入对象（备件/消耗品均可，字段缺失时按安全默认值处理）
 * @returns 'normal' | 'low' | 'out'
 */
export function stockStatus(item: StockStatusInput): StockStatus {
  const qty = Number(item.stock_qty ?? 0)
  if (qty <= 0) return 'out'
  const low = item.is_low_stock != null
    ? !!item.is_low_stock
    : (item.warning_qty != null && qty <= item.warning_qty)
  return low ? 'low' : 'normal'
}

/** 三态展示元数据（el-tag type 兼容） */
export const STOCK_STATUS_META: Record<StockStatus, { label: string; tag: 'success' | 'warning' | 'danger' }> = {
  normal: { label: '正常', tag: 'success' },
  low: { label: '需补仓', tag: 'warning' },
  out: { label: '缺货', tag: 'danger' }
}
