<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">备件（{{ spares.length }}）</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-if="spares.length">
      <view class="card" v-for="s in spares" :key="'s' + s.spare_id">
        <image v-if="s.image_url" class="card__thumb" :src="resolveImage(s.image_url)" mode="aspectFill" />
        <view v-else class="card__thumb card__thumb--text">{{ (s.spare_name || s.spare_code).charAt(0) }}</view>
        <view class="card__main">
          <text class="card__name">{{ s.spare_name || s.spare_code }}</text>
          <text class="card__code">{{ s.spare_code }}</text>
          <text class="card__loc" v-if="s.location_name || s.warehouse_name">
            {{ [s.location_name, s.warehouse_name].filter(Boolean).join(' · ') }}
          </text>
        </view>
        <view class="card__side">
          <text class="qty" :class="{ 'qty--low': s.is_low_stock }">
            {{ s.stock_qty ?? 0 }}{{ s.unit || '' }}
          </text>
          <text v-if="s.is_low_stock" class="tag">低库存</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__text">{{ loaded ? '暂无备件' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSpareParts } from '@/api/material'
import { toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import type { SparePart } from '@/types'

const spares = ref<SparePart[]>([])
const loaded = ref(false)

async function load() {
  loaded.value = false
  try {
    const data = await getSpareParts().catch(() => [])
    spares.value = toArray(data) as SparePart[]
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
  margin-top: 8rpx;
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
