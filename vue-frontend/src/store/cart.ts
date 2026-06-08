import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tool } from '@/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<Array<Tool & { quantity: number }>>([])

  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  const addToCart = (tool: Tool) => {
    const tid = Number(tool.tool_id)
    const existing = items.value.find(item => Number(item.tool_id) === tid)
    if (existing) return // 已存在则跳过，每个工具唯一
    items.value.push({ ...tool, quantity: 1, tool_id: tid })
  }

  const removeFromCart = (toolId: number) => {
    const index = items.value.findIndex(item => item.tool_id === toolId)
    if (index > -1) {
      items.value.splice(index, 1)
    }
  }

  const updateQuantity = (toolId: number, quantity: number) => {
    const item = items.value.find(item => item.tool_id === toolId)
    if (item) {
      if (quantity <= 0) {
        removeFromCart(toolId)
      } else {
        item.quantity = quantity
      }
    }
  }

  const clearCart = () => {
    items.value = []
  }

  const isInCart = (toolId: number) => {
    return items.value.some(item => item.tool_id === toolId)
  }

  return {
    items,
    totalItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isInCart
  }
})
