<template>
  <div class="page-container">
    <van-nav-bar title="货架导航盘点" left-text="返回列表" left-arrow fixed placeholder @click-left="backToList" />

    <div v-if="loading" class="center-tip"><van-loading size="20" /> 加载中...</div>

    <template v-else-if="check">
      <!-- 仓库（固定=盘库单仓库）+ 进度 -->
      <div class="shelf-header">
        <div class="shelf-warehouse"><van-icon name="location-o" /> 仓库：{{ check.warehouse_name || '未命名' }}</div>
        <div class="shelf-progress">已录入 {{ enteredCount }} / 可导航 {{ navigableCount }}</div>
        <div class="shelf-tip">未分配货位的物料请返回逐项列表盘点</div>
      </div>

      <!-- 第一级：货架（限定当前仓库） -->
      <van-cell-group inset title="选择货架">
        <van-cell
          v-for="s in filteredShelves"
          :key="s.shelf_id"
          :title="s.shelf_name"
          is-link
          :class="{ 'cell-active': selectedShelfId === s.shelf_id }"
          @click="selectShelf(s.shelf_id)"
        >
          <template #right-icon>
            <van-icon v-if="selectedShelfId === s.shelf_id" name="success" color="#07c160" />
          </template>
        </van-cell>
        <div v-if="filteredShelves.length === 0" class="group-empty">该仓库下暂无货架</div>
      </van-cell-group>

      <!-- 第二级：货位（限定所选货架） -->
      <van-cell-group v-if="selectedShelfId" inset title="选择货位">
        <van-cell
          v-for="l in filteredLocations"
          :key="l.location_id"
          :title="l.location_name || l.location_code"
          :label="`${itemsOfLocation(l.location_id).length} 项物料`"
          is-link
          :class="{ 'cell-active': selectedLocationId === l.location_id }"
          @click="selectLocation(l.location_id)"
        >
          <template #right-icon>
            <van-icon v-if="selectedLocationId === l.location_id" name="success" color="#07c160" />
          </template>
        </van-cell>
        <div v-if="filteredLocations.length === 0" class="group-empty">该货架下暂无货位</div>
      </van-cell-group>

      <!-- 第三级：货位下物料卡片（逐项步进器录入） -->
      <div v-if="selectedLocationId" class="location-items">
        <div v-if="currentLocationItems.length === 0" class="empty-state"><p>该货位下无应盘物料</p></div>
        <div
          v-for="item in currentLocationItems"
          :key="item.item_code"
          class="shelf-item"
          :data-code="item.item_code"
        >
          <div class="shelf-item-head">
            <span class="shelf-item-name">{{ item.item_name }}</span>
            <van-tag :type="STOCK_STATUS_META[stockStatus(item)].tag" size="medium">
              {{ STOCK_STATUS_META[stockStatus(item)].label }}
            </van-tag>
            <van-tag v-if="item.entered" type="success">已录入</van-tag>
          </div>
          <div class="shelf-item-code">{{ item.item_code }}</div>
          <div class="shelf-item-stock">
            现有库存：<b>{{ item.system_qty }}</b>{{ item.unit ? ` ${item.unit}` : '' }}
          </div>
          <div class="shelf-item-edit">
            <span class="stepper-label">实盘数量</span>
            <!-- 步进器录入：默认=现有库存，加减/手输即提交（决策：值变化@change 提交，替代 blur） -->
            <van-stepper
              v-model="item.actualInput"
              :min="0"
              :max="999999"
              integer
              :long-press="false"
              @change="onStepperChange(item, $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { getInventoryCheckById, getSpareParts, getConsumables, scanInventoryCheck } from '@/api/material'
import { getShelves, getLocations } from '@/api'
import { stockStatus, STOCK_STATUS_META } from '@/utils/stock'
import { isItemEntered, markEntered } from '@/composables/useInventoryEntered'
import type { InventoryCheck, InventoryCheckItem } from '@/types'

// 货架导航盘点页（P0-5）：仓库固定=盘库单仓库 → 货架 → 货位 逐级定位，
// 货位下物料卡片逐项步进器录入，结果经 scan 接口汇入同一盘库单。
// 返回逐项列表用 router.replace('/inventory?resume_check_id=xx') 自动恢复 scan 态；
// 返回前先补齐未录入项（与 InventoryScan.finish 时机一致，防 complete 清零坑）。
interface ShelfItem extends InventoryCheckItem {
  stock_qty?: number
  shelf_id?: number
  shelf_name?: string
  storage_location_id?: number
  location_name?: string
  unit?: string
  warning_qty?: number | null
  is_low_stock?: boolean
  entered: boolean
  actualInput: number
}

const route = useRoute()
const router = useRouter()

const check = ref<InventoryCheck | null>(null)
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const items = ref<ShelfItem[]>([])
const loading = ref(false)
const selectedShelfId = ref<number | null>(null)
const selectedLocationId = ref<number | null>(null)

const checkId = computed<number>(() => Number(route.query.check_id))

const filteredShelves = computed(() => {
  if (!check.value) return []
  return shelves.value.filter((s) => s.warehouse_id === check.value!.warehouse_id)
})

const filteredLocations = computed(() => {
  if (selectedShelfId.value == null) return []
  return locations.value.filter((l) => l.shelf_id === selectedShelfId.value)
})

// 以 location_id 为键构建 Map<location_id, items[]>（共享知识 #9）
const locationIndex = computed<Map<number, ShelfItem[]>>(() => {
  const map = new Map<number, ShelfItem[]>()
  for (const it of items.value) {
    const lid = it.storage_location_id
    if (lid == null) continue
    if (!map.has(lid)) map.set(lid, [])
    map.get(lid)!.push(it)
  }
  return map
})

const navigableCount = computed<number>(() => {
  let n = 0
  locationIndex.value.forEach((arr) => { n += arr.length })
  return n
})

const enteredCount = computed<number>(() => {
  let n = 0
  locationIndex.value.forEach((arr) => { n += arr.filter((i) => i.entered).length })
  return n
})

const currentLocationItems = computed<ShelfItem[]>(() => {
  if (selectedLocationId.value == null) return []
  return locationIndex.value.get(selectedLocationId.value) || []
})

function itemsOfLocation(locationId: number): ShelfItem[] {
  return locationIndex.value.get(locationId) || []
}

function selectShelf(id: number): void {
  selectedShelfId.value = id
  selectedLocationId.value = null
}

function selectLocation(id: number): void {
  selectedLocationId.value = id
}

/** 返回逐项列表：先补齐未录入项（实际=系统量，diff=0），再跳转；失败不阻塞、toast 汇总 */
async function backToList(): Promise<void> {
  const pending = items.value.filter((i) => !i.entered)
  if (pending.length > 0) {
    const results = await Promise.all(
      pending.map((i) => submitItem(i, i.system_qty, { silent: true }))
    )
    const failed = results.filter((ok) => !ok).length
    if (failed > 0) {
      showFailToast(`${failed} 项补齐失败，请返回逐项列表后重试`)
    }
  }
  router.replace({ path: '/inventory', query: { resume_check_id: String(checkId.value) } })
}

/** 步进器数量归一：非法恢复原值，合法钳制到 [0, 999999] 整数 */
function clampQty(v: number): number {
  return Math.max(0, Math.min(999999, Math.floor(v)))
}

/**
 * 提交单个明细（调 scan 接口 + markEntered，幂等）。
 * @returns true=成功 false=失败（失败已 toast，不抛出，避免阻断批量补齐）
 */
async function submitItem(item: ShelfItem, actual: number, opts: { silent?: boolean } = {}): Promise<boolean> {
  try {
    const res = await scanInventoryCheck(checkId.value, item.item_code, actual)
    item.actual_qty = actual
    if (res?.item?.diff != null) item.diff = res.item.diff
    item.entered = true
    markEntered(checkId.value, item.item_code)
    if (!opts.silent) showSuccessToast(`已录入：${item.item_name}`)
    return true
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '录入失败')
    return false
  }
}

/** 步进器值变化即提交：加减/手输均触发；静默提交避免每步 toast 轰炸，失败仍 toast */
async function onStepperChange(item: ShelfItem, value: number | string): Promise<void> {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    // 非法输入（如清空）恢复当前已录值，不提交
    item.actualInput = item.actual_qty
    return
  }
  const q = clampQty(n)
  item.actualInput = q
  await submitItem(item, q, { silent: true })
}

onMounted(async () => {
  if (!checkId.value) {
    showFailToast('缺少盘库单参数')
    return
  }
  loading.value = true
  try {
    const [c, spares, consumables, shs, locs] = await Promise.all([
      getInventoryCheckById(checkId.value),
      getSpareParts(),
      getConsumables(),
      getShelves(),
      getLocations()
    ])
    check.value = c
    shelves.value = shs
    locations.value = locs

    // 以 item_code 为键富化 check.items（附 shelf/location/unit/warning 等字段）
    const codeMap = new Map<string, any>()
    for (const sp of spares || []) codeMap.set(sp.spare_code, sp)
    for (const c2 of consumables || []) codeMap.set(c2.consumable_code, c2)

    items.value = ((c.items || []) as InventoryCheckItem[])
      .filter((it) => it.item_type === 'spare' || it.item_type === 'consumable')
      .map((it) => {
        const meta = codeMap.get(it.item_code) || {}
        const entered = isItemEntered(checkId.value, it)
        return {
          ...it,
          stock_qty: it.system_qty,
          shelf_id: meta.shelf_id,
          shelf_name: meta.shelf_name,
          storage_location_id: meta.storage_location_id,
          location_name: meta.location_name || meta.storage_location,
          unit: meta.unit,
          warning_qty: meta.warning_qty != null ? meta.warning_qty : null,
          is_low_stock: !!meta.is_low_stock,
          entered,
          actualInput: entered ? it.actual_qty : it.system_qty
        } as ShelfItem
      })
  } catch (e: any) {
    showFailToast(e?.response?.data?.message || e?.message || '加载货架导航失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 40px; }
.center-tip { text-align: center; padding: 60px; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.shelf-header { padding: 12px 16px 4px; }
.shelf-warehouse { font-size: 15px; font-weight: 600; color: #323233; display: flex; align-items: center; gap: 4px; }
.shelf-progress { font-size: 13px; color: #07c160; margin-top: 4px; }
.shelf-tip { font-size: 12px; color: #969799; margin-top: 2px; }
.cell-active { background: #f0f8ff; }
.group-empty { padding: 16px; text-align: center; color: #c8c9cc; font-size: 13px; }
.location-items { padding: 4px 0 16px; }
.shelf-item { background: #fff; margin: 0 12px 8px; border-radius: 8px; padding: 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); }
.shelf-item-head { display: flex; align-items: center; gap: 8px; }
.shelf-item-name { font-size: 15px; font-weight: 600; color: #323233; }
.shelf-item-code { font-size: 12px; color: #969799; margin-top: 4px; }
.shelf-item-stock {
  margin-top: 6px; display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: #576b95; background: #f0f5ff; border-radius: 6px;
  padding: 4px 10px; font-weight: 500;
}
.shelf-item-stock b { font-size: 16px; color: #1989fa; font-weight: 600; }
.shelf-item-edit {
  margin-top: 10px; display: flex; align-items: center; justify-content: space-between;
}
.stepper-label { font-size: 13px; color: #646566; font-weight: 500; }
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
