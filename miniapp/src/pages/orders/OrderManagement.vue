<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">领用工单</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-if="orders.length">
      <view class="card" v-for="o in orders" :key="o.order_id" @tap="goDetail(o)">
        <view class="card__top">
          <text class="card__no">{{ o.order_no }}</text>
          <text class="badge" :style="{ color: meta(o.status).color, background: meta(o.status).bg }">
            {{ meta(o.status).label }}
          </text>
        </view>
        <view class="card__row">
          <text class="card__label">领用人</text>
          <text class="card__value">{{ o.borrower_name || '—' }}</text>
        </view>
        <view class="card__row">
          <text class="card__label">借出时间</text>
          <text class="card__value">{{ formatTime(o.borrow_time) }}</text>
        </view>
        <view class="card__row" v-if="o.expected_return">
          <text class="card__label">预计归还</text>
          <text class="card__value">{{ formatTime(o.expected_return) }}</text>
        </view>
        <view class="card__row" v-if="(o.items || []).length">
          <text class="card__label">物品数</text>
          <text class="card__value">{{ o.items!.length }} 件</text>
        </view>
        <!-- 审核操作：仅审批人（管理员/分队长）对待审批工单可见 -->
        <view class="card__actions" v-if="o.status === 'pending' && auth.isApprover" @tap.stop>
          <view class="btn btn--reject" @tap="reject(o)">拒绝</view>
          <view class="btn btn--approve" @tap="approve(o)">批准</view>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__icon">单</text>
      <text class="empty__text">{{ loaded ? '暂无工单数据' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getOrders, updateOrderStatus } from '@/api'
import { orderStatusMeta, toArray } from '@/utils/status'
import { showToast, showModal } from '@/utils/feedback'
import { useAuthStore } from '@/store/auth'
import { refreshOrderBadge } from '@/composables/useOrderBadge'
import type { Order } from '@/types'

const orders = ref<Order[]>([])
const loaded = ref(false)
const auth = useAuthStore()

function meta(status?: string) {
  return orderStatusMeta(status)
}

function formatTime(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

/** 工单排序：需要操作的优先（待审批 > 借出中/已批准 > 终态），同级按借出时间倒序 */
const ORDER_PRIORITY: Record<string, number> = {
  pending: 0,
  borrowed: 1,
  approved: 2,
  returned: 3,
  rejected: 3,
  cancelled: 3,
  closed: 3
}

async function load() {
  loaded.value = false
  try {
    const data = await getOrders().catch(() => [])
    orders.value = (toArray(data) as Order[]).sort((a, b) => {
      const pa = ORDER_PRIORITY[a.status] ?? 9
      const pb = ORDER_PRIORITY[b.status] ?? 9
      if (pa !== pb) return pa - pb
      return String(b.borrow_time || '').localeCompare(String(a.borrow_time || ''))
    })
    // 同步工单 tab 未处理角标（复用已拉取列表）
    refreshOrderBadge(orders.value)
  } finally {
    loaded.value = true
  }
}

/** 点击工单 → 详情页 */
function goDetail(o: Order) {
  uni.navigateTo({ url: `/pages/orders/OrderDetail?id=${o.order_id}` })
}

/** 批准工单（后端 PUT /orders/:id/status approved，物料单自动扣库存） */
async function approve(o: Order) {
  const ok = await showModal({ title: '批准工单', content: `确认批准 ${o.order_no}？`, confirmText: '批准' })
  if (!ok) return
  try {
    await updateOrderStatus(o.order_id, 'approved')
    await showToast('已批准', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
}

/** 拒绝工单 */
async function reject(o: Order) {
  const ok = await showModal({ title: '拒绝工单', content: `确认拒绝 ${o.order_no}？`, confirmText: '拒绝' })
  if (!ok) return
  try {
    await updateOrderStatus(o.order_id, 'rejected')
    await showToast('已拒绝', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '操作失败', 'none')
  }
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

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__refresh {
    font-size: 26rpx;
    color: $tm-primary;
  }
}

.list {
  flex: 1;
  padding: 16rpx 24rpx;
  box-sizing: border-box;
}

.card {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  &__no {
    font-size: 30rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__row {
    display: flex;
    align-items: center;
    margin-top: 8rpx;
  }

  &__label {
    width: 140rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__value {
    font-size: 26rpx;
    color: $tm-text-secondary;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 20rpx;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid $tm-border-light;
  }
}

.btn {
  padding: 10rpx 40rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 500;

  &--approve {
    background: $tm-success;
    color: #ffffff;
  }

  &--reject {
    background: $tm-card-bg;
    color: $tm-danger;
    border: 1rpx solid $tm-danger;
  }
}

.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $tm-text-muted;

  &__icon {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background: $tm-border-light;
    color: $tm-text-secondary;
    font-size: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
  }

  &__text {
    font-size: 26rpx;
  }
}
</style>
