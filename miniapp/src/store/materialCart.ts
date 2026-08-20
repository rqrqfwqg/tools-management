/**
 * materialCart store — 物料购物车（备件/消耗品独立领用篮，与工具购物车 cart 完全分开）
 *
 * - 购物车项：备件（spare）与消耗品（cons）可混存，按 key 区分
 * - key 格式：`spare:{spare_id}` / `cons:{consumable_id}`
 * - 数量上限受 stock 约束，qty <= 0 自动移除
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface MaterialCartItem {
  key: string
  type: 'spare' | 'cons'
  /** spare_id 或 consumable_id */
  id: number
  code: string
  name: string
  unit: string
  stock: number
  qty: number
  warehouse?: string
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

  /** 加入/累加数量（不超过库存） */
  function addItem(item: Omit<MaterialCartItem, 'qty'>, qty = 1): number {
    const existing = items.value.find((i) => i.key === item.key)
    if (existing) {
      const next = Math.min(existing.qty + qty, existing.stock)
      existing.qty = next
      return next
    }
    const n = Math.min(Math.max(qty, 1), item.stock)
    if (n <= 0) return 0
    items.value.push({ ...item, qty: n })
    return n
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
