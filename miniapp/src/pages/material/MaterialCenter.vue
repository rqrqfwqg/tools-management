<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">物料中心</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list">
      <!-- 备件 -->
      <view class="group-title">备件（{{ spares.length }}）</view>
      <view v-if="spares.length">
        <view class="card" v-for="s in spares" :key="'s' + s.spare_id">
          <view class="card__main">
            <text class="card__name">{{ s.spare_name || s.spare_code }}</text>
            <text class="card__code">{{ s.spare_code }}</text>
          </view>
          <view class="card__side">
            <text class="qty" :class="{ 'qty--low': s.is_low_stock }">{{ s.stock_qty ?? 0 }}{{ s.unit || '' }}</text>
            <text class="card__loc" v-if="s.location_name || s.warehouse_name">{{ s.location_name || s.warehouse_name }}</text>
          </view>
        </view>
      </view>
      <view class="group-empty" v-else-if="loaded">暂无备件</view>

      <!-- 消耗品 -->
      <view class="group-title">消耗品（{{ consumables.length }}）</view>
      <view v-if="consumables.length">
        <view class="card" v-for="c in consumables" :key="'c' + c.consumable_id">
          <view class="card__main">
            <text class="card__name">{{ c.consumable_name || c.consumable_code }}</text>
            <text class="card__code">{{ c.consumable_code }}</text>
          </view>
          <view class="card__side">
            <text class="qty" :class="{ 'qty--low': isLow(c) }">{{ c.stock_qty ?? 0 }}{{ c.unit || '' }}</text>
            <text class="card__loc" v-if="c.location_name || c.warehouse_name">{{ c.location_name || c.warehouse_name }}</text>
          </view>
        </view>
      </view>
      <view class="group-empty" v-else-if="loaded">暂无消耗品</view>

      <view class="group-empty" v-if="!loaded">加载中…</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSpareParts, getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import type { SparePart, Consumable } from '@/types'

const spares = ref<SparePart[]>([])
const consumables = ref<Consumable[]>([])
const loaded = ref(false)

function isLow(c: Consumable): boolean {
  if (c.warning_qty == null) return false
  return (c.stock_qty ?? 0) <= c.warning_qty
}

async function load() {
  loaded.value = false
  try {
    const [sp, co] = await Promise.all([
      getSpareParts().catch(() => []),
      getConsumables().catch(() => [])
    ])
    spares.value = toArray(sp) as SparePart[]
    consumables.value = toArray(co) as Consumable[]
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
  padding: 16rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.group-title {
  margin: 24rpx 8rpx 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.group-empty {
  padding: 16rpx 8rpx 24rpx;
  font-size: 24rpx;
  color: $tm-text-muted;
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
}

.qty {
  font-size: 30rpx;
  font-weight: 600;
  color: $tm-text;

  &--low {
    color: $tm-danger;
  }
}
</style>
