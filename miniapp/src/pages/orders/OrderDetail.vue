<template>
  <view class="page">
    <!-- 加载中 / 未找到 -->
    <view v-if="!loaded" class="center">
      <text class="center__text">加载中…</text>
    </view>
    <view v-else-if="!order" class="center">
      <text class="center__text">工单不存在或已删除</text>
    </view>

    <template v-else>
      <!-- 工单头部 -->
      <view class="head">
        <view class="head__top">
          <text class="head__no">{{ order.order_no }}</text>
          <text class="badge" :style="{ color: meta(order.status).color, background: meta(order.status).bg }">
            {{ meta(order.status).label }}
          </text>
        </view>
        <view class="head__row">
          <text class="head__label">领用人</text>
          <text class="head__value">{{ order.borrower_name || '—' }}</text>
        </view>
        <view class="head__row" v-if="order.warehouse">
          <text class="head__label">仓库</text>
          <text class="head__value">{{ order.warehouse }}</text>
        </view>
        <view class="head__row">
          <text class="head__label">借出时间</text>
          <text class="head__value">{{ formatTime(order.borrow_time) }}</text>
        </view>
        <view class="head__row" v-if="order.expected_return">
          <text class="head__label">预计归还</text>
          <text class="head__value">{{ formatTime(order.expected_return) }}</text>
        </view>
        <view class="head__row" v-if="order.actual_return">
          <text class="head__label">实际归还</text>
          <text class="head__value">{{ formatTime(order.actual_return) }}</text>
        </view>
        <view class="head__row" v-if="order.purpose">
          <text class="head__label">用途</text>
          <text class="head__value">{{ order.purpose }}</text>
        </view>
      </view>

      <!-- 明细 -->
      <view class="section-title">工具 / 物料明细（{{ (order.items || []).length }}）</view>
      <view class="items">
        <view class="item" v-for="it in order.items || []" :key="it.item_id || it.tool_id">
          <image
            v-if="thumb(it)"
            class="item__thumb"
            :src="thumb(it)"
            mode="aspectFill"
          />
          <view v-else class="item__thumb item__thumb--text">{{ (it.tool_name || '?').charAt(0) }}</view>
          <view class="item__main">
            <text class="item__name">{{ it.tool_name }}</text>
            <text class="item__code">{{ it.tool_code }}</text>
          </view>
          <text class="item__status" :style="itemStyle(it.item_status)">{{ itemLabel(it.item_status) }}</text>
        </view>
      </view>

      <!-- 操作区 -->
      <view class="actions" v-if="showActions">
        <!-- 待审批：审批人可见 -->
        <template v-if="order.status === 'pending' && auth.isApprover">
          <view class="btn btn--reject" @tap="reject">拒绝</view>
          <view class="btn btn--approve" @tap="approve">批准</view>
        </template>
        <!-- 借出中：归还需逐件清点 -->
        <view v-else-if="order.status === 'borrowed'" class="btn btn--primary btn--block" @tap="goReturn">
          归还（需逐件清点）
        </view>
        <!-- 已批准：直接归还 -->
        <view v-else-if="order.status === 'approved'" class="btn btn--primary btn--block" @tap="directReturn">
          归还
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getOrders, updateOrderStatus, returnOrder } from '@/api'
import { orderStatusMeta, toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import type { Order, OrderItem } from '@/types'

const auth = useAuthStore()
const orderId = ref(0)
const order = ref<Order | null>(null)
const loaded = ref(false)

const showActions = computed(() => {
  if (!order.value) return false
  const s = order.value.status
  if (s === 'pending') return auth.isApprover
  return s === 'borrowed' || s === 'approved'
})

function meta(status?: string) {
  return orderStatusMeta(status)
}

function formatTime(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

/** 明细项缩略图（后端 /orders 已 enrich image_url） */
function thumb(it: OrderItem): string {
  return resolveImage((it as any).image_url)
}

/** 明细项状态文案（item_status: borrowed/returned/…） */
function itemLabel(s?: string): string {
  const map: Record<string, string> = { borrowed: '借出中', returned: '已归还', pending: '待审批' }
  return s ? map[s] || s : '—'
}

function itemStyle(s?: string) {
  const color = s === 'borrowed' ? '#ff976a' : s === 'returned' ? '#07c160' : '#999999'
  return { color }
}

async function load() {
  loaded.value = false
  try {
    const data = await getOrders().catch(() => [])
    const list = toArray(data) as Order[]
    order.value = list.find(o => o.order_id === orderId.value) || null
  } finally {
    loaded.value = true
  }
}

onLoad((options) => {
  orderId.value = Number(options?.id || 0)
})

onShow(() => {
  if (orderId.value) load()
})

/** 批准 / 拒绝（待审批 + 审批人） */
async function approve() {
  if (!order.value) return
  const ok = await showModal({ title: '批准工单', content: `确认批准 ${order.value.order_no}？`, confirmText: '批准' })
  if (!ok) return
  try {
    await updateOrderStatus(order.value.order_id, 'approved')
    await showToast('已批准', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

async function reject() {
  if (!order.value) return
  const ok = await showModal({ title: '拒绝工单', content: `确认拒绝 ${order.value.order_no}？`, confirmText: '拒绝' })
  if (!ok) return
  try {
    await updateOrderStatus(order.value.order_id, 'rejected')
    await showToast('已拒绝', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

/** 借出中 → 进入归还清点页 */
function goReturn() {
  if (!order.value) return
  uni.navigateTo({ url: `/pages/orders/OrderReturn?id=${order.value.order_id}` })
}

/** 已批准 → 直接归还 */
async function directReturn() {
  if (!order.value) return
  const ok = await showModal({ title: '归还', content: `确认归还 ${order.value.order_no} 的全部物品？`, confirmText: '归还' })
  if (!ok) return
  try {
    await returnOrder(order.value.order_id)
    await showToast('已归还', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '归还失败', 'none')
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  padding: 24rpx;
  box-sizing: border-box;
}

.center {
  padding-top: 200rpx;
  display: flex;
  justify-content: center;

  &__text {
    color: $tm-text-muted;
    font-size: 28rpx;
  }
}

.head {
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 28rpx;
  box-shadow: $tm-shadow-card;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__no {
    font-size: 32rpx;
    font-weight: 700;
    color: $tm-text;
  }

  &__row {
    display: flex;
    align-items: center;
    margin-top: 10rpx;
  }

  &__label {
    width: 140rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__value {
    flex: 1;
    font-size: 26rpx;
    color: $tm-text-secondary;
  }
}

.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.section-title {
  margin: 32rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.items {
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 8rpx 24rpx;
  box-shadow: $tm-shadow-card;
}

.item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $tm-border-light;

  &:last-child {
    border-bottom: none;
  }

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: $tm-radius-sm;
    background: $tm-border-light;
    margin-right: 20rpx;
    flex-shrink: 0;

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36rpx;
      font-weight: 600;
      color: $tm-text-secondary;
      background: $tm-primary-bg;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: $tm-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__code {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: $tm-text-muted;
  }

  &__status {
    margin-left: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
  }
}

.actions {
  margin-top: 40rpx;
  display: flex;
  gap: 24rpx;
}

.btn {
  padding: 20rpx 48rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;

  &--block {
    flex: 1;
  }

  &--approve {
    background: $tm-success;
    color: #ffffff;
  }

  &--reject {
    background: $tm-card-bg;
    color: $tm-danger;
    border: 1rpx solid $tm-danger;
  }

  &--primary {
    background: $tm-primary;
    color: #ffffff;
  }
}
</style>
