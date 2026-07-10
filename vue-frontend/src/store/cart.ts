import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tool } from '@/types'

export interface CartItem extends Tool {
  quantity: number
  item_type?: 'tool' | 'spare'
  spare_id?: number
  spare_code?: string
  spare_name?: string
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  // 生成唯一键：工具用 tool_id，备件用 spare_id
  const keyOf = (item: any) => item.item_type === 'spare' ? `spare-${item.spare_id}` : `tool-${item.tool_id}`

  const addToCart = (item: any) => {
    const key = keyOf(item)
    const existing = items.value.find(i => keyOf(i) === key)
    if (existing) return // 已存在则跳过
    items.value.push({ ...item, quantity: 1, item_type: item.item_type || 'tool' })
  }

  const removeFromCart = (key: string) => {
    const index = items.value.findIndex(item => keyOf(item) === key)
    if (index > -1) {
      items.value.splice(index, 1)
    }
  }

  const updateQuantity = (key: string, quantity: number) => {
    const item = items.value.find(i => keyOf(i) === key)
    if (item) {
      if (quantity <= 0) {
        removeFromCart(key)
      } else {
        item.quantity = quantity
      }
    }
  }

  const clearCart = () => {
    items.value = []
  }

  const isInCart = (key: string) => {
    return items.value.some(item => keyOf(item) === key)
  }

  return {
    items,
    totalItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart,
    keyOf
  }
})
