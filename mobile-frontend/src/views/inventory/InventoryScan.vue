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
          <van-tag :type="item.item_type === 'spare' ? 'primary' : 'success'">
            {{ item.item_type === 'spare' ? '备件' : '消耗品' }}
          </van-tag>
          <van-tag v-if="item.entered" type="success">已录入</van-tag>
        </div>
        <div class="scan-item-code">{{ item.item_code }} · 系统账 {{ item.system_qty }}</div>
        <div class="scan-item-edit">
          <!-- 备件/消耗品统一 digit 实盘数量录入（决策 #6：备件允许 >1） -->
          <van-field
            v-model="item.actualInput"
            type="digit"
            label="实盘数量"
            :border="false"
            placeholder="请输入实数"
            @blur="onInputBlur(item)"
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
import { scanInventoryCheck } from '@/api/material'
import { isItemEntered, markEntered } from '@/composables/useInventoryEntered'
import InventoryScannerPopup from '@/components/InventoryScannerPopup.vue'
import type { InventoryCheck, InventoryCheckItem } from '@/types'

// 态2：以 items 为应盘清单逐项录入 actual_qty；备件/消耗品均 digit 实盘输入。
// 支持扫码命中预填 + 定位高亮 + blur 提交覆盖；暂停复用 pending 状态（决策 #5）。
interface ScanItem extends InventoryCheckItem {
  entered: boolean
  actualInput: string
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
  // 恢复 entered：actual_qty!==system_qty 或本地集合有录入痕迹（幂等）
  items.value = (props.check.items || []).map((i: InventoryCheckItem) => {
    const entered = isItemEntered(checkId.value, i)
    return {
      ...i,
      entered,
      actualInput: entered ? String(i.actual_qty) : ''
    }
  })
})

/** 解析 digit 输入：空白返回 null（不提交），非法返回 null */
function parseQty(v: string): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = parseFloat(s)
  if (isNaN(n) || n < 0) return null
  return Math.floor(n)
}

/** 编码前缀门禁（决策 #7）：仅 BJ-/XH- 属盘点范围，G-/BX-/未知一律拦截 */
function detectPrefix(code: string): 'spare' | 'consumable' | 'tool' | '' {
  if (code.startsWith('BJ-')) return 'spare'
  if (code.startsWith('XH-')) return 'consumable'
  if (code.startsWith('G-') || code.startsWith('BX-')) return 'tool'
  return ''
}

/** 扫码命中处理：预填 system_qty（可改）→ 提交 → markEntered → 定位高亮滚动 */
async function onScannedCode(raw: string): Promise<void> {
  const code = raw.trim()
  if (!code) return
  const type = detectPrefix(code)
  if (type === 'tool' || !type) {
    showFailToast('不在本次盘点范围')
    return
  }
  const target = items.value.find((i) => i.item_code === code)
  if (!target) {
    showFailToast('不在本次盘点范围')
    return
  }
  // 预填系统量（可改）；扫码视为"确认以系统量为准"，用户可修改后 blur 再次提交覆盖
  target.actualInput = String(target.system_qty)
  await submitItem(target, target.system_qty)
  scrollToItem(code)
}

/** 提交单个明细（调 scan 接口 + markEntered，幂等） */
async function submitItem(item: ScanItem, actual: number): Promise<void> {
  try {
    const res = await scanInventoryCheck(checkId.value, item.item_code, actual)
    item.actual_qty = actual
    if (res?.item?.diff != null) item.diff = res.item.diff
    item.entered = true
    markEntered(checkId.value, item.item_code)
    showSuccessToast(`已录入：${item.item_name}`)
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '录入失败')
  }
}

/** blur 提交：空白=未录入不提交；非法值恢复上次值 */
async function onInputBlur(item: ScanItem): Promise<void> {
  if (item.actualInput.trim() === '') return
  const n = parseQty(item.actualInput)
  if (n == null) {
    showFailToast('请输入有效数量')
    item.actualInput = item.actual_qty !== 0 ? String(item.actual_qty) : ''
    return
  }
  await submitItem(item, n)
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

function finish(): void {
  emit('complete', props.check)
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
.scan-item-edit { margin-top: 8px; }
.scan-float {
  position: fixed; right: 16px; bottom: 70px; width: 56px; height: 56px;
  background: #07c160; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4); z-index: 100; cursor: pointer;
}
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
