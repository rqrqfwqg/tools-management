// 物料列表组合式：封装备件/消耗品加载、关键词搜索与低库存判定。
// 供「物料领用」页面复用，避免在视图中散落数据逻辑。
import { ref, computed } from 'vue'
import { getSpareParts, getConsumables } from '@/api/material'

export type MaterialTab = 'spare' | 'consumable'

/**
 * 物料列表状态管理
 * @returns list 原始数据、keyword 搜索词、loading 加载态、tab 当前页签、filtered 过滤后列表、isLowStock 低库存判定、load 加载方法
 */
export function useMaterialList() {
  const list = ref<any[]>([])
  const keyword = ref('')
  const loading = ref(false)
  const tab = ref<MaterialTab>('spare')

  /** 关键词过滤（名称/编码，大小写不敏感） */
  const filtered = computed<any[]>(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return list.value
    return list.value.filter((item: any) => {
      const name = (item.spare_name || item.consumable_name || item.name || '').toLowerCase()
      const code = (item.spare_code || item.consumable_code || item.code || '').toLowerCase()
      return name.includes(kw) || code.includes(kw)
    })
  })

  /** 低库存判定：warning_qty 非空 且 库存 <= 预警值 */
  const isLowStock = (item: any): boolean =>
    !!item && item.warning_qty != null && item.stock_qty != null && item.stock_qty <= item.warning_qty

  /** 加载指定页签的物料列表 */
  async function load(t: MaterialTab): Promise<void> {
    tab.value = t
    loading.value = true
    try {
      list.value = t === 'spare' ? await getSpareParts() : await getConsumables()
    } finally {
      loading.value = false
    }
  }

  return { list, keyword, loading, tab, filtered, isLowStock, load }
}
