import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tool } from '@/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<Array<Tool & { quantity: number }>>([])

  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

  const addToCart = (tool: Tool) => {
    const existing = items.value.find(item => item.tool_id === tool.tool_id)
    if (existing) {
      if (existing.quantity < 1) {
        existing.quantity += 1
      }
    } else {
      items.value.push({ ...tool, quantity: 1 })
    }
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
