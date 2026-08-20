<template>
  <div class="inventory-scan">
    <!-- 顶部进度 + 操作按钮（置顶吸附） -->
    <div class="scan-header">
      <div class="scan-progress-text">已录入 {{ enteredCount }} / 应盘 {{ totalCount }}</div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="scan-actions">
        <van-button size="small" plain type="warning" @click="emit('pause')">暂停并退出</van-button>
        <van-button size="small" plain type="primary" @click="emit('go-shelf')">货架导航</van-button>
        <van-button type="primary" size="small" round :loading="finishing" @click="finish">完成盘库</van-button>
      </div>
    </div>

    <van-search v-model="keyword" placeholder="搜索编码/名称" shape="round" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="items.length === 0" class="empty-state"><p>暂无应盘明细</p></div>
      <div
        v-for="item in filteredItems"
        :key="item.item_code"
        :data-code="item.item_code"
        class="scan-item"
        :class="{ 'scan-item--highlight': highlightCode === item.item_code }"
      >
        <div class="scan-item-head">
          <span class="scan-item-name">{{ item.item_name }}</span>
          <van-tag :type="item.item_type === 'spare' ? 'primary' : 'warning'">
            {{ item.item_type === 'spare' ? '备件' : '消耗品' }}
          </van-tag>
          <van-tag v-if="item.entered" type="success">已录入</van-tag>
        </div>
        <div class="scan-item-code">{{ item.item_code }}</div>
        <div class="scan-item-stock">现有库存：<b>{{ item.system_qty }}</b></div>
        <div class="scan-item-edit">
          <span class="stepper-label">实盘数量</span>
          <!-- 步进器录入：默认=系统现有库存，加减/手输即提交（决策：值变化@change 提交，替代 blur） -->
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
    </van-pull-refresh>

    <!-- 浮动扫码按钮 -->
    <div class="scan-float" @click="showScanner = true">
      <van-icon name="scan" size="28" />
    </div>

    <!-- 盘点扫码弹窗（复用 useScanner，只 emit code，业务门禁在本页） -->
    <InventoryScannerPopup
      :show="showScanner"
      @update:show="showScanner = $event"
      @code="onScannedCode"
      @close="onScannerClosed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showSuccessToast, showFailToast } from 'vant'
import { scanInventoryCheck, resolveInventoryCheck } from '@/api/material'
import { isItemEntered, markEntered } from '@/composables/useInventoryEntered'
import InventoryScannerPopup from '@/components/InventoryScannerPopup.vue'
import type { InventoryCheck, InventoryCheckItem } from '@/types'

// 态2：以 items 为应盘清单逐项录入 actual_qty；备件/消耗品均步进器实盘输入。
// 支持扫码命中预填 + 定位高亮 + @change 提交覆盖；暂停复用 pending 状态（决策 #5）。
interface ScanItem extends InventoryCheckItem {
  entered: boolean
  actualInput: number
}

const props = defineProps<{
  check: InventoryCheck
}>()

const emit = defineEmits<{
  complete: [check: InventoryCheck]
  cancel: []
  pause: []
  'go-shelf': []
}>()

const items = ref<ScanItem[]>([])
const keyword = ref('')
const refreshing = ref(false)
const finishing = ref(false)
const showScanner = ref(false)
const highlightCode = ref('')

const checkId = computed<number>(() => props.check.check_id)

const totalCount = computed(() => items.value.length)
const enteredCount = computed(() => items.value.filter((i) => i.entered).length)
const progressPercent = computed(() =>
  totalCount.value ? Math.round((enteredCount.value / totalCount.value) * 100) : 0
)

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter(
    (i) => i.item_name?.toLowerCase().includes(kw) || i.item_code?.toLowerCase().includes(kw)
  )
})

onMounted(() => {
  // 恢复 entered：沿用 actual_qty!==system_qty 或本地集合（幂等）；
  // 未录入项实盘输入框默认=系统现有库存，盘点人直接核对或微调（决策：默认读取现有库存）。
  items.value = (props.check.items || []).map((i: InventoryCheckItem) => {
    const entered = isItemEntered(checkId.value, i)
    return {
      ...i,
      entered,
      actualInput: entered ? i.actual_qty : i.system_qty
    }
  })
})

/** 步进器数量归一：非法恢复原值，合法钳制到 [0, 999999] 整数 */
function clampQty(v: number): number {
  return Math.max(0, Math.min(999999, Math.floor(v)))
}

/**
 * 扫码命中处理：前缀无关（后端 resolve 统一解析货位码/物料编码）。
 * ① 先按物料编码在应盘清单中直接定位；② 定位不到则调 resolve 接口解析货位码 → 绑定物料；
 * 命中后预填 system_qty → 提交（扫码=确认以系统量为准，可再改步进器覆盖）→ markEntered → 高亮滚动。
 */
async function onScannedCode(raw: string): Promise<void> {
  const code = raw.trim().toUpperCase()
  if (!code) return
  let target = items.value.find((i) => i.item_code === code)
  if (!target) {
    // 货位码：走 resolve-only 解析出绑定物料，再映射回应盘清单
    try {
      const resolved: any = await resolveInventoryCheck(checkId.value, code)
      if (resolved?.item_code) {
        target = items.value.find((i) => i.item_code === resolved.item_code) || null
      }
      if (!target) {
        showFailToast('该货位/物料不在本次盘点范围')
        return
      }
    } catch (err: any) {
      showFailToast(err?.response?.data?.message || err?.message || '编码无法识别')
      return
    }
  }
  target.actualInput = target.system_qty
  await submitItem(target, target.system_qty)
  scrollToItem(target.item_code)
}

/**
 * 提交单个明细（调 scan 接口 + markEntered，幂等）。
 * @returns true=成功 false=失败（失败已 toast，不抛出，避免阻断批量补齐）
 */
async function submitItem(item: ScanItem, actual: number, opts: { silent?: boolean } = {}): Promise<boolean> {
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
async function onStepperChange(item: ScanItem, value: number | string): Promise<void> {
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

/** 定位 DOM(data-code) → 高亮 → scrollIntoView */
function scrollToItem(code: string): void {
  highlightCode.value = code
  const el = document.querySelector(`[data-code="${code}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      highlightCode.value = ''
    }, 1500)
  }
}

function onScannerClosed(): void {
  // 弹窗关闭后无需额外处理；若需恢复扫码由弹窗内部管理
}

/**
 * 完成盘库：不自动补齐未录入项（后端 complete 仅对「已录入且有差异」项生成 in/out 流水，
 * 未录入项保持原库存不动），直接进入 complete 流程。
 */
async function finish(): Promise<void> {
  if (finishing.value) return
  finishing.value = true
  try {
    emit('complete', props.check)
  } finally {
    finishing.value = false
  }
}

function onRefresh(): void {
  refreshing.value = false
}
</script>

<style scoped>
.inventory-scan { padding-bottom: 24px; }
.scan-header {
  position: sticky; top: 46px; z-index: 10; background: #f7f8fa;
  padding: 10px 16px 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.scan-progress-text { font-size: 14px; color: #323233; margin-bottom: 6px; font-weight: 500; }
.progress-track { height: 6px; background: #ebedf0; border-radius: 3px; overflow: hidden; margin-bottom: 12px; }
.progress-fill { height: 100%; background: #07c160; transition: width 0.3s; }
.scan-actions { display: flex; gap: 8px; }
.scan-actions .van-button { flex: 1; }
.scan-item { background: #fff; margin: 0 12px 8px; border-radius: 8px; padding: 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); transition: background 0.3s; }
.scan-item--highlight { background: #e8f7ee; box-shadow: 0 0 0 2px #07c160; }
.scan-item-head { display: flex; align-items: center; gap: 8px; }
.scan-item-name { font-size: 15px; font-weight: 600; color: #323233; }
.scan-item-code { font-size: 12px; color: #969799; margin-top: 4px; }
.scan-item-stock {
  margin-top: 6px; display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; color: #576b95; background: #f0f5ff; border-radius: 6px;
  padding: 4px 10px; font-weight: 500;
}
.scan-item-stock b { font-size: 16px; color: #1989fa; font-weight: 600; }
.scan-item-edit {
  margin-top: 10px; display: flex; align-items: center; justify-content: space-between;
}
.stepper-label { font-size: 13px; color: #646566; font-weight: 500; }
.scan-float {
  position: fixed; right: 16px; bottom: 70px; width: 56px; height: 56px;
  background: #07c160; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4); z-index: 100; cursor: pointer;
}
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
