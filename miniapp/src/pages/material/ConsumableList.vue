<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">消耗品（{{ consumables.length }}）</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <!-- 出库类型切换：需工单 / 免工单 -->
    <view class="tabs">
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': active === 'all' }"
        @tap="switchTab('all')"
      >全部</view>
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': active === 'workorder' }"
        @tap="switchTab('workorder')"
      >需工单出库</view>
      <view
        class="tabs__item"
        :class="{ 'tabs__item--active': active === 'direct' }"
        @tap="switchTab('direct')"
      >免工单出库</view>
    </view>

    <scroll-view scroll-y class="list" v-show="consumables.length">
      <view class="card" v-for="c in consumables" :key="'c' + c.consumable_id">
        <view v-if="c.image_url" class="card__thumb">
          <image :src="resolveImage(c.image_url)" mode="aspectFill" class="card__thumb-img" />
        </view>
        <view v-else class="card__thumb card__thumb--text">{{ (c.consumable_name || c.consumable_code).charAt(0) }}</view>
        <view class="card__main">
          <text class="card__name">{{ c.consumable_name || c.consumable_code }}</text>
          <text class="card__code">{{ c.consumable_code }}</text>
          <text class="card__loc" v-if="c.location_name || c.warehouse_name">
            {{ [c.location_name, c.warehouse_name].filter(Boolean).join(' · ') }}
          </text>
        </view>
        <view class="card__side">
          <text class="outbound" :class="'outbound--' + (c.outbound_type || 'direct')">
            {{ OUTBOUND_TYPE_TEXT[c.outbound_type || 'direct'] }}
          </text>
          <text class="qty" :class="{ 'qty--low': isLow(c) }">{{ c.stock_qty ?? 0 }}{{ c.unit || '' }}</text>
          <text v-if="isLow(c)" class="tag">低库存</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-show="!consumables.length">
      <text class="empty__text">{{ loaded ? '暂无消耗品' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import { OUTBOUND_TYPE_TEXT } from '@/constants/material'
import type { Consumable } from '@/types'

const active = ref<'all' | 'workorder' | 'direct'>('all')
const consumables = ref<Consumable[]>([])
const loaded = ref(false)

function isLow(c: Consumable): boolean {
  if (c.warning_qty == null) return false
  return (c.stock_qty ?? 0) <= c.warning_qty
}

async function load() {
  loaded.value = false
  try {
    const params =
      active.value === 'all' ? {} : { outbound_type: active.value }
    const data = await getConsumables(params).catch(() => [])
    consumables.value = toArray(data) as Consumable[]
  } finally {
    loaded.value = true
  }
}

function switchTab(tab: 'all' | 'workorder' | 'direct') {
  if (active.value === tab) return
  active.value = tab
  load()
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

.tabs {
  display: flex;
  background: $tm-card-bg;
  padding: 12rpx 24rpx;
  gap: 16rpx;

  &__item {
    flex: 1;
    text-align: center;
    padding: 14rpx 0;
    font-size: 26rpx;
    color: $tm-text-secondary;
    border-radius: $tm-radius-sm;
    background: $tm-bg;

    &--active {
      color: #fff;
      background: $tm-primary;
      font-weight: 600;
    }
  }
}

.list {
  flex: 1;
  padding: 16rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 28rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: $tm-radius-sm;
    margin-right: 20rpx;
    flex-shrink: 0;
    background: $tm-border-light;
    overflow: hidden;

    &-img {
      width: 100%;
      height: 100%;
    }

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      background: $tm-success-bg;
      color: $tm-success;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__code {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__loc {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }
}

.card__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 8rpx;
}

.outbound {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;

  &--workorder { color: #7c4dff; background: rgba(124, 77, 255, 0.12); }
  &--direct { color: $tm-success; background: $tm-success-bg; }
}

.qty {
  font-size: 30rpx;
  font-weight: 600;
  color: $tm-text;

  &--low {
    color: $tm-danger;
  }
}

.tag {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: $tm-danger;
  background: $tm-danger-bg;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &__text {
    font-size: 26rpx;
    color: $tm-text-muted;
  }
}
</style>
