<template>
  <view class="page">
    <!-- 顶部：单号 + 状态 + 完成 -->
    <view class="header">
      <view class="header__top">
        <text class="header__title">{{ check?.check_no || '盘库' }}</text>
        <text v-if="statusText" class="header__status" :class="`header__status--${check?.status}`">{{ statusText }}</text>
        <view class="header__finish" :class="{ 'header__finish--disabled': finishing || locked }" @tap="finish">
          {{ finishing ? '提交中…' : '完成盘库' }}
        </view>
      </view>
      <view class="header__progress">已扫 {{ enteredCount }} 项{{ locked ? ' · 已锁定录入' : '' }}</view>
    </view>

    <view v-if="locked" class="locked-banner">
      <text class="locked-banner__icon">🔒</text>
      <text class="locked-banner__text">本盘库单{{ statusText }}，已锁定录入。如需继续盘点，请新建盘库单。</text>
    </view>

    <!-- 当前扫码条目：扫到货位后显示，系统库存作参考，录入实盘 -->
    <view v-if="current" class="current">
      <view class="current__head">
        <text class="current__loc">{{ current.location_code || '—' }}</text>
        <text class="type-tag" :class="typeClass(current.item_type)">{{ typeText(current.item_type) }}</text>
        <text v-if="current.counted" class="current__re">已录入</text>
      </view>
      <view class="current__name">{{ current.item_name }}<text class="current__code">（{{ current.item_code }}）</text></view>
      <view v-if="current.item_type === 'spare_item'" class="current__ref">备件单品（一对一码）· 现场核对是否在库</view>
      <view v-else class="current__ref">系统库存 <text class="current__ref-num">{{ current.system_qty }}</text> · 以现场清点为准</view>
      <view class="current__input-row" v-if="current.item_type === 'spare_item'">
        <text class="current__input-label">实盘</text>
        <view class="presence">
          <view class="presence__btn" :class="{ 'presence__btn--on': currentInput === 1 }" @tap="setPresence(1)">在库</view>
          <view class="presence__btn" :class="{ 'presence__btn--on presence__btn--off': currentInput === 0 }" @tap="setPresence(0)">缺失</view>
        </view>
        <view class="current__submit" :class="{ 'current__submit--disabled': locked }" @tap="submitCurrent">确定</view>
      </view>
      <view class="current__input-row" v-else>
        <text class="current__input-label">实盘数量</text>
        <input
          class="current__input"
          type="number"
          :value="String(currentInput)"
          :focus="focusInput"
          :disabled="locked"
          @blur="onCurrentBlur"
        />
        <view class="current__submit" :class="{ 'current__submit--disabled': locked }" @tap="submitCurrent">确定</view>
      </view>
    </view>

    <!-- 已扫清单（累加） -->
    <scroll-view
      scroll-y
      class="list"
      v-show="items.length"
      :scroll-into-view="highlightCode ? 'it-' + highlightCode : ''"
      scroll-with-animation
    >
      <view
        class="item"
        v-for="it in items"
        :key="it.location_code || it.item_code"
        :class="{ 'item--highlight': highlightCode === (it.location_code || it.item_code).toUpperCase() }"
        :id="'it-' + (it.location_code || it.item_code)"
      >
        <view class="item__head">
          <text class="item__loc">{{ it.location_code || '—' }}</text>
          <text class="item__name">{{ it.item_name }}</text>
          <text class="type-tag" :class="typeClass(it.item_type)">{{ typeText(it.item_type) }}</text>
        </view>
        <view class="item__row">
          <text class="item__cell">系统 {{ it.system_qty }}</text>
          <text class="item__cell">实盘 {{ it.actual_qty }}</text>
          <text class="item__diff" :class="diffClass(it)">{{ diffText(it) }}</text>
        </view>
        <view class="item__op">盘点人：{{ it.operator_name || '—' }}</view>
      </view>
    </scroll-view>

    <view class="empty" v-show="!items.length && !current">
      <text class="empty__text">扫货位二维码开始盘点（货位可放多件备件/消耗品；备件单品按一对一码核对在库）</text>
    </view>

    <!-- 扫码按钮 -->
    <view class="scan-float" :class="{ 'scan-float--disabled': locked }" @tap="doScan">
      <text class="scan-float__icon">📷</text>
      <text class="scan-float__text">扫码</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInventoryCheckById, scanInventoryCheck, resolveInventoryCheck, completeInventoryCheck } from '@/api/material'
import { useScanner } from '@/composables/useScanner'
import { showToast, showModal } from '@/utils/feedback'

interface ScanItem {
  location_code: string
  location_name?: string
  shelf_name?: string
  item_type: string
  item_id: number
  item_code: string
  item_name: string
  system_qty: number
  actual_qty: number
  diff: number
  counted: boolean
  operator_id?: number | null
  operator_name?: string
}

const checkId = ref(0)
const check = ref<any>(null)
const items = ref<ScanItem[]>([])
const loaded = ref(false)
const finishing = ref(false)
const highlightCode = ref('')
const { scan } = useScanner()

// 当前扫码条目（扫到货位后显示，等待录入实盘；失焦/确定即提交）
const current = ref<any>(null)
const currentInput = ref<number>(0)
const focusInput = ref(false)

const enteredCount = computed(() => items.value.length)
const locked = computed(() => !!check.value?.status && check.value.status !== 'pending')
const statusText = computed(() => {
  const s = check.value?.status
  if (s === 'completed') return '已完成'
  if (s === 'cancelled') return '已取消'
  if (s === 'pending') return '进行中'
  return ''
})

onLoad(async (options) => {
  checkId.value = Number(options?.id || 0)
  if (checkId.value) await load()
})

async function load() {
  loaded.value = false
  try {
    const data = await getInventoryCheckById(checkId.value).catch(() => null)
    check.value = data
    items.value = (data?.items || []).map((i: any) => ({ ...i }))
  } finally {
    loaded.value = true
  }
}

/** 物料类型 → 标签文案/样式（备件单品/备件/消耗品） */
function typeText(t: string): string {
  if (t === 'spare_item') return '备件单品'
  if (t === 'spare') return '备件'
  return '消耗品'
}
function typeClass(t: string): string {
  if (t === 'spare_item' || t === 'spare') return 'type-tag--spare'
  return 'type-tag--cons'
}
/** 备件单品存在性录入：1=在库 0=缺失 */
function setPresence(v: number): void {
  if (locked.value) return
  currentInput.value = v
  submitCurrent()
}

function diffOf(it: any): number {
  return Number(it.diff ?? (Number(it.actual_qty ?? 0) - Number(it.system_qty ?? 0)))
}
function diffText(it: any): string {
  const d = diffOf(it)
  if (d > 0) return `多 ${d}`
  if (d < 0) return `少 ${Math.abs(d)}`
  return '一致'
}
function diffClass(it: any): string {
  const d = diffOf(it)
  if (d > 0) return 'item__diff--pos'
  if (d < 0) return 'item__diff--neg'
  return ''
}

/** 扫码：扫货位码/物料码 → resolve 解析（仅返回物料+系统库存+货位，不写入）→ 显示参考 + 录入框 */
async function doScan() {
  if (locked.value) {
    await showToast('盘库已完成，不可录入', 'none')
    return
  }
  const res = await scan()
  if (!res?.code) return
  const code = res.code.trim().toUpperCase()
  try {
    const resolved: any = await resolveInventoryCheck(checkId.value, code)
    if (!resolved?.item_code) {
      await showToast('未找到该货位/物料', 'none')
      return
    }
    const locCode = resolved.location?.location_code || ''
    const locKey = (locCode || resolved.item_code).toUpperCase()
    const existing = items.value.find(it => (it.location_code || it.item_code || '').toUpperCase() === locKey)
    current.value = {
      location_code: locCode,
      location_name: resolved.location?.location_name || '',
      shelf_name: resolved.location?.shelf_name || '',
      item_type: resolved.item_type,
      item_id: resolved.item_id,
      item_code: resolved.item_code,
      item_name: resolved.item_name,
      system_qty: resolved.system_qty,
      actual_qty: existing ? Number(existing.actual_qty) : Number(resolved.system_qty),
      counted: !!existing
    }
    currentInput.value = current.value.actual_qty
    focusInput.value = true
    setTimeout(() => { focusInput.value = false }, 2500)
    await showToast(
      `${locCode ? '货位 ' + locCode + ' · ' : ''}${resolved.item_name} · 系统库存 ${resolved.system_qty}`,
      'none'
    )
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '编码无法识别', 'none')
  }
}

/** 提交实盘：扫码累加为一项（同货位重复扫=更新）；未变化也允许提交以确认账实相符 */
async function submitCurrent() {
  if (!current.value || locked.value) return
  const cur = current.value
  const qty = Math.max(0, Math.floor(Number(currentInput.value) || 0))
  try {
    const resp: any = await scanInventoryCheck(checkId.value, cur.location_code || cur.item_code, qty)
    const saved = resp?.item || resp
    const locKey = (cur.location_code || cur.item_code).toUpperCase()
    const row: ScanItem = {
      location_code: saved.location_code ?? cur.location_code,
      location_name: saved.location_name ?? cur.location_name,
      shelf_name: saved.shelf_name ?? cur.shelf_name,
      item_type: saved.item_type ?? cur.item_type,
      item_id: saved.item_id ?? cur.item_id,
      item_code: saved.item_code ?? cur.item_code,
      item_name: saved.item_name ?? cur.item_name,
      system_qty: saved.system_qty ?? cur.system_qty,
      actual_qty: saved.actual_qty,
      diff: saved.diff,
      counted: true,
      operator_id: saved.operator_id,
      operator_name: saved.operator_name
    }
    const idx = items.value.findIndex(it => (it.location_code || it.item_code || '').toUpperCase() === locKey)
    if (idx >= 0) items.value[idx] = row
    else items.value.push(row)
    highlightCode.value = locKey
    setTimeout(() => { highlightCode.value = '' }, 1500)
    current.value = null
    await showToast('已录入', 'success')
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  }
}

function onCurrentBlur() {
  focusInput.value = false
  submitCurrent()
}

/** 完成盘库：仅对「已录入且有差异」项由后端生成 in/out 流水（署名该盘点人）；一致项不动 */
async function finish() {
  if (locked.value) {
    await showToast('盘库已完成，不可录入', 'none')
    return
  }
  if (finishing.value) return
  if (!items.value.length) {
    const ok = await showModal({
      title: '完成盘库',
      content: '尚未扫描任何货位，确认直接完成空盘库单？',
      confirmText: '完成'
    })
    if (!ok) return
  } else {
    const diffN = items.value.filter(it => diffOf(it) !== 0).length
    const ok = await showModal({
      title: '完成盘库',
      content: `已扫 ${items.value.length} 项，其中 ${diffN} 项有差异（多→入库、少→出库，署名盘点人）。确认完成？`,
      confirmText: '完成'
    })
    if (!ok) return
  }
  finishing.value = true
  try {
    await completeInventoryCheck(checkId.value)
    uni.redirectTo({ url: `/pages/inventory/InventoryResult?id=${checkId.value}` })
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '完成失败', 'none')
  } finally {
    finishing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
}

.header {
  background: $tm-card-bg;
  padding: 24rpx 32rpx 20rpx;

  &__top { display: flex; align-items: center; justify-content: space-between; }
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__status {
    margin-left: 16rpx;
    padding: 2rpx 14rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: $tm-success;
    background: $tm-success-bg;
    &--completed { color: $tm-text-secondary; background: $tm-border-light; }
    &--cancelled { color: $tm-danger; background: $tm-danger-bg; }
  }
  &__finish {
    padding: 10rpx 28rpx;
    border-radius: 999rpx;
    background: $tm-success;
    color: #ffffff;
    font-size: 26rpx;
    font-weight: 500;
    &--disabled { background: $tm-border; }
  }
  &__progress { margin-top: 16rpx; font-size: 24rpx; color: $tm-text-secondary; }
}

.locked-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 12rpx 24rpx 0;
  padding: 16rpx 22rpx;
  border-radius: $tm-radius-sm;
  background: $tm-warning-bg;
  border: 1rpx solid #faecd8;

  &__icon { font-size: 26rpx; }
  &__text { font-size: 24rpx; color: $tm-warning; line-height: 1.4; }
}

/* 当前扫码条目 */
.current {
  margin: 16rpx 24rpx 0;
  padding: 22rpx 26rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  box-shadow: $tm-shadow-card;
  border: 2rpx solid $tm-primary;

  &__head { display: flex; align-items: center; gap: 12rpx; }
  &__loc { font-size: 28rpx; font-weight: 600; color: $tm-primary; }
  &__re { margin-left: auto; font-size: 20rpx; color: $tm-success; background: $tm-success-bg; padding: 2rpx 12rpx; border-radius: 999rpx; }
  &__name { margin-top: 8rpx; font-size: 28rpx; font-weight: 500; color: $tm-text; }
  &__code { font-size: 22rpx; color: $tm-text-muted; font-weight: 400; }
  &__ref { margin-top: 10rpx; font-size: 24rpx; color: $tm-text-secondary; }
  &__ref-num { font-size: 28rpx; font-weight: 600; color: $tm-text; }
  &__input-row { display: flex; align-items: center; gap: 16rpx; margin-top: 18rpx; }
  &__input-label { font-size: 26rpx; color: $tm-text; }
  &__input {
    flex: 1;
    height: 64rpx;
    border-radius: 12rpx;
    border: 1rpx solid $tm-border;
    background: $tm-bg;
    text-align: center;
    font-size: 30rpx;
    color: $tm-text;
  }
  &__submit {
    padding: 0 32rpx;
    height: 64rpx;
    line-height: 64rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
    font-weight: 500;
    &--disabled { background: $tm-border; }
  }
}

.presence {
  display: flex;
  gap: 16rpx;
  flex: 1;

  &__btn {
    flex: 1;
    height: 64rpx;
    line-height: 64rpx;
    text-align: center;
    border-radius: 12rpx;
    border: 1rpx solid $tm-border;
    background: $tm-bg;
    color: $tm-text-secondary;
    font-size: 28rpx;

    &--on {
      background: $tm-success;
      color: #fff;
      border-color: $tm-success;
    }
    &--off {
      background: $tm-danger;
      color: #fff;
      border-color: $tm-danger;
    }
  }
}

.list { flex: 1; padding: 16rpx 24rpx 120rpx; box-sizing: border-box; }

.item {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 22rpx 26rpx;
  margin-bottom: 14rpx;
  box-shadow: $tm-shadow-card;
  border: 2rpx solid transparent;

  &--highlight { background: $tm-warning-bg; }

  &__head { display: flex; align-items: center; gap: 12rpx; }
  &__loc { font-size: 24rpx; font-weight: 600; color: $tm-primary; }
  &__name { flex: 1; font-size: 28rpx; font-weight: 500; color: $tm-text; }
  &__row { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; }
  &__cell { font-size: 24rpx; color: $tm-text-secondary; }
  &__diff { font-size: 26rpx; font-weight: 600; color: $tm-text-muted; }
  &__diff--neg { color: $tm-danger; }
  &__diff--pos { color: $tm-success; }
  &__op { margin-top: 8rpx; font-size: 22rpx; color: $tm-text-muted; }
}

.type-tag {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  &--spare { color: $tm-primary; background: $tm-primary-bg; }
  &--cons { color: $tm-success; background: $tm-success-bg; }
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; padding: 0 40rpx; text-align: center; }
}

.scan-float {
  position: fixed;
  right: 40rpx;
  bottom: calc(60rpx + env(safe-area-inset-bottom));
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: $tm-primary;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(25, 137, 250, 0.4);

  &__icon { font-size: 40rpx; line-height: 1; }
  &__text { margin-top: 4rpx; font-size: 20rpx; color: #ffffff; }

  &--disabled {
    background: $tm-border;
    box-shadow: none;
  }
}
</style>
