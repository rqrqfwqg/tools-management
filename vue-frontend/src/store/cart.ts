import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface CartItem {
  item_id?: number
  tool_id?: number
  tool_code?: string
  tool_name?: string
  spare_id?: number
  spare_code?: string
  spare_name?: string
  item_type: 'tool' | 'spare'
  quantity: number
  stock_qty?: number
  image_url?: string
  category_name?: string
  storage_location?: string
  warehouse?: string
  [key: string]: any
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  // 购物车类型：工具 / 备件 / 空。强制单类型，混合加入时先清空旧类型。
  const cartType = computed<'tool' | 'spare' | null>(() => {
    if (items.value.length === 0) return null
    return items.value[0].item_type
  })

  const totalItems = computed(() => items.value.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0))
  const toolItems = computed(() => items.value.filter(i => i.item_type !== 'spare'))
  const materialItems = computed(() => items.value.filter(i => i.item_type === 'spare'))

  // 生成唯一键：工具用 tool_id，备件用 spare_id
  const keyOf = (item: any) => item.item_type === 'spare' ? `spare-${item.spare_id}` : `tool-${item.tool_id}`

  const addToCart = (item: any) => {
    const type: 'tool' | 'spare' = item.item_type || 'tool'
    // 单类型强制：购物车已有其他类型时先清空，避免混提单报错
    if (cartType.value && cartType.value !== type) {
      items.value = []
    }
    const key = keyOf(item)
    const existing = items.value.find(i => keyOf(i) === key)
    if (existing) {
      // 已存在则数量 +1（上限 = 可用库存）
      const max = type === 'spare' ? Math.max(Number(item.stock_qty) || 1, 1) : 1
      existing.quantity = Math.min((Number(existing.quantity) || 1) + 1, max)
      return
    }
    items.value.push({ ...item, quantity: 1, item_type: type })
  }

  const removeFromCart = (key: string) => {
    const index = items.value.findIndex(item => keyOf(item) === key)
    if (index > -1) {
      items.value.splice(index, 1)
    }
  }

  // 数量更新：工具恒为 1；备件上限 = 可用库存（stock_qty），<=0 移除
  const updateQuantity = (key: string, quantity: number) => {
    const item = items.value.find(i => keyOf(i) === key)
    if (!item) return
    const max = item.item_type === 'spare' ? Math.max(Number(item.stock_qty) || 1, 1) : 1
    const q = Math.floor(Number(quantity) || 0)
    if (q <= 0) {
      removeFromCart(key)
      return
    }
    item.quantity = Math.min(q, max)
  }

  const clearCart = () => {
    items.value = []
  }

  const isInCart = (key: string) => {
    return items.value.some(item => keyOf(item) === key)
  }

  // 构建下单 payload：工具→{tool_ids:number[]}，物料→{spare_items:[{spare_id,qty}]}
  const buildOrderPayload = (extra: Record<string, any> = {}) => {
    if (cartType.value === 'spare') {
      return {
        spare_items: materialItems.value.map(i => ({ spare_id: i.spare_id, qty: Number(i.quantity) || 1 })),
        ...extra
      }
    }
    return {
      tool_ids: toolItems.value.map(i => i.tool_id),
      ...extra
    }
  }

  return {
    items,
    cartType,
    totalItems,
    toolItems,
    materialItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart,
    keyOf,
    buildOrderPayload
  }
})
