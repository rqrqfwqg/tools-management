<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">领用工单</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-if="orders.length">
      <view class="card" v-for="o in orders" :key="o.order_id">
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
import { getOrders } from '@/api'
import { orderStatusMeta, toArray } from '@/utils/status'
import type { Order } from '@/types'

const orders = ref<Order[]>([])
const loaded = ref(false)

function meta(status?: string) {
  return orderStatusMeta(status)
}

function formatTime(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

async function load() {
  loaded.value = false
  try {
    const data = await getOrders().catch(() => [])
    orders.value = toArray(data) as Order[]
  } finally {
    loaded.value = true
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
