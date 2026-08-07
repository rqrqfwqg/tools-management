/**
 * useInventoryEntered — 盘点"已录入"标记唯一入口（小程序适配版）
 *
 * 自 mobile-frontend/src/composables/useInventoryEntered.ts 拷贝并适配：
 * localStorage 直接调用 → utils/storage.ts（get/set）
 *
 * 决策 #3/#6：已录入判定 = actual_qty !== system_qty 或 编码在本地集合（"有录入痕迹"语义）。
 * 后端 items 无 entered 字段，服务端 scan 不传 actual_qty 时默认取系统量（diff=0），
 * 仅凭 diff 无法区分"已扫未改"与"未扫"，故前端用本地存储记录已录入编码集合。
 *
 * 存储 key：`inventory_entered_<checkId>`，值为编码数组（JSON），幂等写入。
 * entered 为前端瞬时字段，不落库；多设备不共享（决策 #D，本轮接受）。
 */
import { get, set } from '@/utils/storage'

const KEY_PREFIX = 'inventory_entered_'

/** 读取某盘库单的已录入编码集合（读失败静默返回空集合） */
export function getEnteredCodes(checkId: number): Set<string> {
  try {
    const raw = get(`${KEY_PREFIX}${checkId}`)
    if (!raw) return new Set()
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

/** 标记某编码已录入（幂等；存储不可用时静默降级，仅影响标记不影响盘库正确性） */
export function markEntered(checkId: number, code: string): void {
  try {
    const set = getEnteredCodes(checkId)
    set.add(code)
    set(`${KEY_PREFIX}${checkId}`, [...set])
  } catch {
    // 忽略写入异常（隐私模式等场景），不影响主流程
  }
}

/**
 * 已录入判定：actual_qty 与 system_qty 不一致 或 有录入痕迹（本地集合）。
 * 供恢复/进度/货架导航共用，禁止页面自造逻辑。
 */
export function isItemEntered(
  checkId: number,
  item: { item_code: string; system_qty: number; actual_qty: number }
): boolean {
  if (item.actual_qty !== item.system_qty) return true
  return getEnteredCodes(checkId).has(item.item_code)
}
