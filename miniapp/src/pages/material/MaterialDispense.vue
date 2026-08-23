<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">物料领用</text>
      <view class="bar__actions">
        <text class="bar__refresh" @tap="scanMaterialCode">扫码</text>
        <text class="bar__refresh" @tap="load">刷新</text>
      </view>
    </view>

    <!-- 页签：备件单品 / 消耗品 -->
    <view class="tabs">
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': tab === 'spare_item' }"
        @tap="switchTab('spare_item')"
      >备件</view>
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': tab === 'consumable' }"
        @tap="switchTab('consumable')"
      >消耗品</view>
    </view>

    <!-- 消耗品出库类型筛选 -->
    <view class="subtabs" v-if="tab === 'consumable'">
      <view
        class="subtabs__item"
        :class="{ 'subtabs__item--active': sub === 'all' }"
        @tap="switchSub('all')"
      >全部</view>
      <view
        class="subtabs__item"
        :class="{ 'subtabs__item--active': sub === 'workorder' }"
        @tap="switchSub('workorder')"
      >需工单</view>
      <view
        class="subtabs__item"
        :class="{ 'subtabs__item--active': sub === 'direct' }"
        @tap="switchSub('direct')"
      >免工单</view>
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
        <view class="card__thumb card__thumb--text">{{ nameOf(item).charAt(0) }}</view>
        <view class="card__main">
          <text class="card__name">{{ nameOf(item) }}</text>
          <text class="card__code">{{ codeOf(item) }}</text>
          <text class="card__stock" :class="{ 'card__stock--low': isLowStock(item) }">
            <template v-if="tab === 'spare_item'">单品 · {{ statusOf(item) }}</template>
            <template v-else>库存 {{ stockOf(item) }}{{ unitOf(item) }}</template>
          </text>
        </view>
        <view class="card__side">
          <!-- 备件单品：一对一，加入即 1 件 -->
          <view v-if="tab === 'spare_item'">
            <view
              v-if="!cart.hasItem(itemKey(item))"
              class="add-btn"
              @tap="addSpareItem(item)"
            >加入</view>
            <text v-else class="added">已加入</text>
          </view>
          <!-- 消耗品：数量步进 -->
          <view v-else-if="stockOf(item) > 0 && !auth.isGuest" class="stepper">
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
      <view class="submit-bar__btn" @tap="goCart">去购物车提交</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSpareItems, getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import { showToast } from '@/utils/feedback'
import { SPARE_ITEM_STATUS_TEXT } from '@/constants/material'
import { useAuthStore } from '@/store/auth'
import { useScanner } from '@/composables/useScanner'
import { useMaterialCartStore } from '@/store/materialCart'
import type { SpareItem, Consumable } from '@/types'

type Tab = 'spare_item' | 'consumable'
type Sub = 'all' | 'workorder' | 'direct'

const tab = ref<Tab>('spare_item')
const sub = ref<Sub>('all')
const keyword = ref('')
const spares = ref<SpareItem[]>([])
const consumables = ref<Consumable[]>([])
const loaded = ref(false)
const auth = useAuthStore()
const cart = useMaterialCartStore()
const { scan } = useScanner({ title: '扫码领用' })

const displayList = computed<any[]>(() => {
  if (tab.value === 'spare_item') return spares.value
  let list = consumables.value
  if (sub.value !== 'all') list = list.filter((c) => (c.outbound_type || 'direct') === sub.value)
  return list
})

const filtered = computed<any[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return displayList.value
  return displayList.value.filter((item) => {
    const name = (item.spare_name || item.consumable_name || '').toLowerCase()
    const code = (item.spare_code || item.consumable_code || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

const selectedCount = computed<number>(() => cart.count)

function itemKey(item: any): string {
  if (item.item_id != null) return `spare_item:${item.item_id}`
  return `cons:${item.consumable_id}`
}
function nameOf(item: any): string {
  return item.spare_name || item.consumable_name || ''
}
function codeOf(item: any): string {
  return item.spare_code || item.consumable_code || ''
}
function stockOf(item: any): number {
  return tab.value === 'spare_item' ? 1 : Number(item.stock_qty ?? 0)
}
function unitOf(item: any): string {
  return item.unit || ''
}
function statusOf(item: any): string {
  return SPARE_ITEM_STATUS_TEXT[item.status] || item.status
}
function isLowStock(item: any): boolean {
  return item.warning_qty != null && stockOf(item) <= item.warning_qty
}
function qtyOf(item: any): number {
  return cart.getQty(itemKey(item))
}

/** 购物车条目构造 */
function cartItemOf(item: any) {
  if (item.item_id != null) {
    return {
      key: itemKey(item),
      type: 'spare_item' as const,
      id: item.item_id,
      code: item.spare_code,
      name: item.spare_name || item.spare_code,
      unit: item.unit || '件',
      stock: 1
    }
  }
  const ot = (item.outbound_type || 'direct') as 'workorder' | 'direct'
  return {
    key: itemKey(item),
    type: 'cons' as const,
    id: item.consumable_id,
    code: item.consumable_code,
    name: item.consumable_name || item.consumable_code,
    unit: item.unit || '',
    stock: Number(item.stock_qty ?? 0),
    outboundType: ot
  }
}

function addSpareItem(item: any): void {
  if (item.status && item.status !== 'in_stock') {
    showToast('该单品不在库，无法借用', 'none')
    return
  }
  cart.addItem(cartItemOf(item), 1)
  showToast(`已加入「${nameOf(item)}」`, 'success')
}

function inc(item: any): void {
  const cur = qtyOf(item)
  const max = stockOf(item)
  if (cur >= max) {
    showToast(`最多可领 ${max}${unitOf(item)}`, 'none')
    return
  }
  cart.addItem(cartItemOf(item), 1)
}
function dec(item: any): void {
  cart.setQty(itemKey(item), qtyOf(item) - 1)
}

async function load(): Promise<void> {
  loaded.value = false
  try {
    const [sp, co] = await Promise.all([
      getSpareItems().catch(() => []),
      getConsumables().catch(() => [])
    ])
    spares.value = toArray(sp) as SpareItem[]
    consumables.value = toArray(co) as Consumable[]
  } finally {
    loaded.value = true
  }
}

/** 扫码选料：备件单品码 / 消耗品码 自动加入购物车 */
async function scanMaterialCode(): Promise<void> {
  if (auth.isGuest) {
    showToast('游客模式仅可查看', 'none')
    return
  }
  const res = await scan()
  if (!res) return
  const c = res.code.trim().toUpperCase()
  const spare = spares.value.find((s) => (s.spare_code || '').toUpperCase() === c)
  if (spare) {
    tab.value = 'spare_item'
    addSpareItem(spare)
    return
  }
  const cons = consumables.value.find((x) => (x.consumable_code || '').toUpperCase() === c)
  if (cons) {
    tab.value = 'consumable'
    if (stockOf(cons) <= 0) {
      showToast('该消耗品无库存', 'none')
      return
    }
    cart.addItem(cartItemOf(cons), 1)
    showToast(`已加入购物车「${nameOf(cons)}」`, 'success')
    return
  }
  showToast('未找到该编码的物料', 'none')
}

function goCart(): void {
  uni.navigateTo({ url: '/pages/material/MaterialCart' })
}
function switchTab(t: Tab): void {
  if (tab.value === t) return
  tab.value = t
}
function switchSub(s: Sub): void {
  sub.value = s
}

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

  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__actions { display: flex; align-items: center; gap: 24rpx; }
  &__refresh { font-size: 26rpx; color: $tm-primary; }
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

.subtabs {
  display: flex;
  margin: 16rpx 24rpx 0;
  gap: 16rpx;

  &__item {
    flex: 1;
    text-align: center;
    padding: 12rpx 0;
    font-size: 24rpx;
    color: $tm-text-secondary;
    border-radius: $tm-radius-sm;
    background: $tm-card-bg;

    &--active {
      color: #fff;
      background: $tm-success;
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
  &__ph { color: $tm-text-muted; }
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
    width: 80rpx;
    height: 80rpx;
    border-radius: $tm-radius-sm;
    margin-right: 20rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $tm-primary-bg;
    color: $tm-primary;
    font-size: 32rpx;
    font-weight: 600;
  }

  &__main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  &__name { font-size: 30rpx; color: $tm-text; font-weight: 500; }
  &__code { margin-top: 6rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__stock {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
    &--low { color: $tm-danger; }
  }
  &__side { display: flex; align-items: center; }
  &__soldout { font-size: 24rpx; color: $tm-text-muted; }
}

.add-btn {
  padding: 10rpx 28rpx;
  border-radius: 999rpx;
  background: $tm-primary;
  color: #fff;
  font-size: 26rpx;
}
.added {
  font-size: 26rpx;
  color: $tm-success;
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
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $tm-card-bg;
  border-top: 1rpx solid $tm-border;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);

  &__text { font-size: 28rpx; color: $tm-text; }
  &__btn {
    padding: 14rpx 48rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
  }
}
</style>
