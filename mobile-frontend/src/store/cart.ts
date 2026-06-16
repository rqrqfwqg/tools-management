import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface CartItem {
  tool_id: number
  tool_name: string
  tool_code: string
  warehouse: string
  image_url?: string
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const count = computed(() => items.value.length)

  function addItem(item: CartItem) {
    const tid = Number(item.tool_id)
    if (!items.value.find(i => Number(i.tool_id) === tid)) {
      items.value.push({ ...item, tool_id: tid })
    }
  }

  function removeItem(toolId: number) {
    items.value = items.value.filter(i => i.tool_id !== toolId)
  }

  function clearAll() {
    items.value = []
  }

  function hasItem(toolId: number) {
    return items.value.some(i => i.tool_id === toolId)
  }

  return { items, count, addItem, removeItem, clearAll, hasItem }
})
