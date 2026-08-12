/**
 * 工单 tab 未处理角标
 * 统计需要操作的工单数（pending 待审批 + borrowed 借出中待归还），设置到工单 tab（index 3）。
 * 使用原生 uni.setTabBarBadge，数量 0 时移除角标。
 */
import { getOrders } from '@/api'
import { toArray } from '@/utils/status'

const ORDER_TAB_INDEX = 3

/** 计算待处理工单数（pending + borrowed） */
export function countPendingOrders(list: any[]): number {
  return list.filter((o) => o.status === 'pending' || o.status === 'borrowed').length
}

/** 刷新工单 tab 角标；可传入已拉取的订单列表复用（避免重复请求） */
export async function refreshOrderBadge(existing?: any[]): Promise<void> {
  try {
    const list = existing ?? toArray(await getOrders().catch(() => []))
    const count = countPendingOrders(list)
    if (count > 0) {
      uni.setTabBarBadge({ index: ORDER_TAB_INDEX, text: count > 99 ? '99+' : String(count) })
    } else {
      uni.removeTabBarBadge({ index: ORDER_TAB_INDEX })
    }
  } catch {
    // 角标失败不影响主流程，静默
  }
}
