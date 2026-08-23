/**
 * materialCart store — 物料购物车（备件/消耗品独立领用篮，与工具购物车 cart 完全分开）
 *
 * - 购物车项：备件单品（spare_item）、旧数量型备件（spare）、消耗品（cons）可混存，按 key 区分
 * - key 格式：`spare_item:{item_id}` / `spare:{spare_id}` / `cons:{consumable_id}`
 * - 备件单品为序列化一对一管理，每件即 1 实物，qty 恒为 1
 * - 数量型项数量上限受 stock 约束，qty <= 0 自动移除
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface MaterialCartItem {
  key: string
  type: 'spare_item' | 'spare' | 'cons'
  /** spare_item 为 item_id；spare 为 spare_id；cons 为 consumable_id */
  id: number
  code: string
  name: string
  unit: string
  stock: number
  qty: number
  warehouse?: string
  /** 消耗品出库方式（需工单 / 免工单）；spare_item 无此字段 */
  outboundType?: 'workorder' | 'direct'
}

export const useMaterialCartStore = defineStore('materialCart', () => {
  const items = ref<MaterialCartItem[]>([])

  /** 已选条目数（qty>0） */
  const count = computed(() => items.value.filter((i) => i.qty > 0).length)
  /** 总数量 */
  const totalQty = computed(() => items.value.reduce((s, i) => s + i.qty, 0))

  function getQty(key: string): number {
    return items.value.find((i) => i.key === key)?.qty || 0
  }

  function hasItem(key: string): boolean {
    return items.value.some((i) => i.key === key && i.qty > 0)
  }

  /** 加入/累加数量（不超过库存；备件单品恒为 1） */
  function addItem(item: Omit<MaterialCartItem, 'qty'>, qty = 1): number {
    const existing = items.value.find((i) => i.key === item.key)
    if (existing) {
      if (existing.type === 'spare_item') return existing.qty // 单品不可累加
      const next = Math.min(existing.qty + qty, existing.stock)
      existing.qty = next
      return next
    }
    const cap = item.type === 'spare_item' ? 1 : Math.min(Math.max(qty, 1), item.stock)
    if (cap <= 0) return 0
    items.value.push({ ...item, qty: cap })
    return cap
  }

  /** 设置数量（<=0 移除） */
  function setQty(key: string, qty: number): void {
    const existing = items.value.find((i) => i.key === key)
    if (!existing) return
    if (qty <= 0) {
      items.value = items.value.filter((i) => i.key !== key)
      return
    }
    existing.qty = Math.min(qty, existing.stock)
  }

  function removeItem(key: string): void {
    items.value = items.value.filter((i) => i.key !== key)
  }

  function clearAll(): void {
    items.value = []
  }

  return { items, count, totalQty, getQty, hasItem, addItem, setQty, removeItem, clearAll }
})
