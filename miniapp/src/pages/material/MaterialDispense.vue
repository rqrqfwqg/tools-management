<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">物料领用</text>
      <view class="bar__actions">
        <text class="bar__refresh" @tap="scanMaterialCode">扫码</text>
        <text class="bar__refresh" @tap="load">刷新</text>
      </view>
    </view>

    <!-- 页签 -->
    <view class="tabs">
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': tab === 'spare' }"
        @tap="switchTab('spare')"
      >备件</view>
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': tab === 'consumable' }"
        @tap="switchTab('consumable')"
      >消耗品</view>
    </view>

    <!-- 搜索 -->
    <view class="search">
      <input
        v-model="keyword"
        class="search__input"
        placeholder="搜索名称/编码"
        placeholder-class="search__ph"
        confirm-type="search"
      />
    </view>

    <scroll-view scroll-y class="list">
      <view class="card" v-for="item in displayList" :key="itemKey(item)">
        <image v-if="item.image_url" class="card__thumb" :src="resolveImage(item.image_url)" mode="aspectFill" />
        <view v-else class="card__thumb card__thumb--text">{{ nameOf(item).charAt(0) }}</view>
        <view class="card__main">
          <text class="card__name">{{ nameOf(item) }}</text>
          <text class="card__code">{{ codeOf(item) }}</text>
          <text class="card__stock" :class="{ 'card__stock--low': isLowStock(item) }">
            库存 {{ stockOf(item) }}{{ unitOf(item) }}
          </text>
        </view>
        <view class="card__side">
          <view v-if="stockOf(item) > 0 && !auth.isGuest" class="stepper">
            <view class="stepper__btn" @tap="dec(item)">−</view>
            <text class="stepper__val">{{ qtyOf(item) }}</text>
            <view class="stepper__btn" @tap="inc(item)">＋</view>
          </view>
          <text v-else-if="stockOf(item) > 0" class="card__soldout">可查看</text>
          <text v-else class="card__soldout">无库存</text>
        </view>
      </view>
      <view class="tip" v-if="loaded && !displayList.length">暂无数据</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>

    <!-- 底部提交栏（游客隐藏） -->
    <view class="submit-bar" v-if="selectedCount > 0 && !auth.isGuest">
      <text class="submit-bar__text">已选 {{ selectedCount }} 项</text>
      <view class="submit-bar__btn" @tap="submit">{{ submitting ? '提交中…' : '提交领用' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getSpareParts, getConsumables, takeConsumableByCode, claimSpareParts } from '@/api/material'
import { toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import { useScanner } from '@/composables/useScanner'
import { requestSubscribe } from '@/composables/useWxSubscribe'

type Tab = 'spare' | 'consumable'

const tab = ref<Tab>('spare')
const keyword = ref('')
const spares = ref<any[]>([])
const consumables = ref<any[]>([])
const loaded = ref(false)
const submitting = ref(false)
const auth = useAuthStore()
/** 从扫码页带过来的编码（等列表加载完成后自动选中） */
const pendingCode = ref('')
const { scan } = useScanner({ title: '扫码领用' })
/** 数量选择：key=`spare:{id}` / `cons:{id}`，切换页签保留已选数量 */
const qtyMap = ref<Record<string, number>>({})

const displayList = computed<any[]>(() => (tab.value === 'spare' ? spares.value : consumables.value))

const filtered = computed<any[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return displayList.value
  return displayList.value.filter((item) => {
    const name = (item.spare_name || item.consumable_name || item.name || '').toLowerCase()
    const code = (item.spare_code || item.consumable_code || item.code || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

const selectedCount = computed<number>(() =>
  Object.keys(qtyMap.value).reduce((n, k) => n + (qtyMap.value[k] > 0 ? 1 : 0), 0)
)

function itemKey(item: any): string {
  return item.spare_id != null ? `spare:${item.spare_id}` : `cons:${item.consumable_id}`
}
function nameOf(item: any): string {
  return item.spare_name || item.consumable_name || ''
}
function codeOf(item: any): string {
  return item.spare_code || item.consumable_code || ''
}
function stockOf(item: any): number {
  return Number(item.stock_qty ?? 0)
}
function unitOf(item: any): string {
  return item.unit || ''
}
function isLowStock(item: any): boolean {
  return item.warning_qty != null && stockOf(item) <= item.warning_qty
}
function qtyOf(item: any): number {
  return qtyMap.value[itemKey(item)] || 0
}
function setQty(key: string, qty: number): void {
  qtyMap.value = { ...qtyMap.value, [key]: qty }
}

function inc(item: any): void {
  const key = itemKey(item)
  const max = stockOf(item)
  const cur = qtyOf(item)
  if (cur >= max) {
    showToast(`最多可领 ${max}${unitOf(item)}`, 'none')
    return
  }
  setQty(key, cur + 1)
}

function dec(item: any): void {
  const key = itemKey(item)
  const cur = qtyOf(item)
  if (cur <= 0) return
  setQty(key, cur - 1)
}

async function load(): Promise<void> {
  loaded.value = false
  try {
    const [sp, co] = await Promise.all([
      getSpareParts().catch(() => []),
      getConsumables().catch(() => [])
    ])
    spares.value = toArray(sp)
    consumables.value = toArray(co)
  } finally {
    loaded.value = true
    // 扫码页跳转携带的编码：列表就绪后自动选中
    if (pendingCode.value) {
      const c = pendingCode.value
      pendingCode.value = ''
      if (!matchAndSelect(c)) {
        showToast('未找到该编码的物料', 'none')
      }
    }
  }
}

/** 按编码匹配并选中（备件优先，其次消耗品）；匹配成功返回 true */
function matchAndSelect(raw: string): boolean {
  const c = (raw || '').trim().toUpperCase()
  if (!c) return false
  const spare = spares.value.find((s) => (s.spare_code || '').toUpperCase() === c)
  if (spare) {
    if (tab.value !== 'spare') tab.value = 'spare'
    if (stockOf(spare) <= 0) {
      showToast('该备件无库存', 'none')
      return true
    }
    setQty(itemKey(spare), 1)
    showToast(`已选中「${nameOf(spare)}」`, 'success')
    return true
  }
  const cons = consumables.value.find((x) => (x.consumable_code || '').toUpperCase() === c)
  if (cons) {
    if (tab.value !== 'consumable') tab.value = 'consumable'
    if (stockOf(cons) <= 0) {
      showToast('该消耗品无库存', 'none')
      return true
    }
    setQty(itemKey(cons), 1)
    showToast(`已选中「${nameOf(cons)}」`, 'success')
    return true
  }
  return false
}

/** 扫码选料：扫物料码 → 自动选中数量 1 */
async function scanMaterialCode(): Promise<void> {
  if (auth.isGuest) {
    showToast('游客模式仅可查看', 'none')
    return
  }
  const res = await scan()
  if (!res) return
  if (!matchAndSelect(res.code)) {
    showToast('未找到该编码的物料', 'none')
  }
}

function switchTab(t: Tab): void {
  if (tab.value === t) return
  tab.value = t
}

async function submit(): Promise<void> {
  const spareItems = spares.value
    .filter((s) => qtyOf(s) > 0)
    .map((s) => ({ spare_id: s.spare_id, qty: qtyOf(s) }))
  const consItems = consumables.value.filter((c) => qtyOf(c) > 0)
  if (!spareItems.length && !consItems.length) {
    showToast('请先选择要领用的物料', 'none')
    return
  }
  const parts = [
    spareItems.length ? `备件 ${spareItems.length} 项` : '',
    consItems.length ? `消耗品 ${consItems.length} 项` : ''
  ].filter(Boolean).join('、')
  const ok = await showModal({
    title: '确认领用',
    content: `确认提交${parts}？备件领走即扣库存，消耗品直接领取。`
  })
  if (!ok) return

  submitting.value = true
  try {
    let msg = ''
    if (spareItems.length) {
      const res = await claimSpareParts(spareItems)
      msg = `备件已领取${res?.order?.order_no ? `（${res.order.order_no}）` : ''}，库存已扣减`
    }
    if (consItems.length) {
      await Promise.all(
        consItems.map((c) => takeConsumableByCode(codeOf(c), qtyOf(c)))
      )
      msg = msg ? `${msg}；消耗品已领取` : '消耗品已领取'
    }
    qtyMap.value = {}
    await showToast(msg, 'success')
    // 领用成功后请求订阅授权（续期），保证后续「领用成功 / 未归还提醒」能送达
    requestSubscribe('both', true)
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  // 从扫码页（ScanTool）跳转：携带 code 参数，列表加载完成后自动选中
  if (options?.code) {
    pendingCode.value = decodeURIComponent(String(options.code))
  }
})

onShow(() => {
  load()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: $tm-card-bg;

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 24rpx;
  }

  &__refresh {
    font-size: 26rpx;
    color: $tm-primary;
  }
}

.tabs {
  display: flex;
  margin: 20rpx 24rpx 0;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;

  &__item {
    flex: 1;
    text-align: center;
    padding: 18rpx 0;
    font-size: 28rpx;
    color: $tm-text-secondary;
    border-radius: $tm-radius-sm;

    &--active {
      background: $tm-primary;
      color: #ffffff;
      font-weight: 600;
    }
  }
}

.search {
  padding: 20rpx 24rpx 8rpx;

  &__input {
    background: $tm-card-bg;
    border-radius: 999rpx;
    padding: 16rpx 28rpx;
    font-size: 26rpx;
    color: $tm-text;
  }

  &__ph {
    color: $tm-text-muted;
  }
}

.list {
  flex: 1;
  padding: 8rpx 24rpx 120rpx;
  box-sizing: border-box;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-top: 16rpx;
  box-shadow: $tm-shadow-card;

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: $tm-radius-sm;
    margin-right: 20rpx;
    flex-shrink: 0;
    background: $tm-border-light;

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      background: $tm-primary-bg;
      color: $tm-primary;
      font-size: 36rpx;
      font-weight: 600;
    }
  }

  &__main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 30rpx;
    color: $tm-text;
    font-weight: 500;
  }

  &__code {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__stock {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;

    &--low {
      color: $tm-danger;
    }
  }

  &__side {
    display: flex;
    align-items: center;
  }

  &__soldout {
    font-size: 24rpx;
    color: $tm-text-muted;
  }
}

.stepper {
  display: flex;
  align-items: center;
  gap: 16rpx;

  &__btn {
    width: 56rpx;
    height: 56rpx;
    line-height: 52rpx;
    text-align: center;
    border-radius: $tm-radius-sm;
    background: $tm-primary-bg;
    color: $tm-primary;
    font-size: 36rpx;
  }

  &__val {
    min-width: 48rpx;
    text-align: center;
    font-size: 30rpx;
    font-weight: 600;
    color: $tm-text;
  }
}

.tip {
  padding: 48rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $tm-text-muted;
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  /* 底部安全区避让：避免全面屏/鸿蒙手势条遮挡按钮（HarmonyOS 适配 §3） */
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $tm-card-bg;
  border-top: 1rpx solid $tm-border;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);

  &__text {
    font-size: 28rpx;
    color: $tm-text;
  }

  &__btn {
    padding: 14rpx 48rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
  }
}
</style>
