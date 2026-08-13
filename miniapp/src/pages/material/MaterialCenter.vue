<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">物料中心</text>
      <view class="bar__actions">
        <text v-if="!auth.isGuest" class="bar__dispense" @tap="goDispense">物料领用</text>
        <text class="bar__refresh" @tap="load">刷新</text>
      </view>
    </view>

    <!-- 概览 -->
    <view class="summary" v-if="loaded">
      <text class="summary__item">备件 {{ spares.length }}</text>
      <text class="summary__sep">·</text>
      <text class="summary__item">消耗品 {{ consumables.length }}</text>
      <text class="summary__sep">·</text>
      <text class="summary__item summary__item--warn">低库存 {{ lowCount }}</text>
    </view>
    <view class="summary" v-else>加载中…</view>

    <view class="entries">
      <!-- 备件入口 -->
      <view class="entry" @tap="goSpares">
        <view class="entry__icon entry__icon--blue">备</view>
        <view class="entry__info">
          <text class="entry__title">备件</text>
          <text class="entry__sub">按型号管理 · 领用生成工单</text>
        </view>
        <view class="entry__right">
          <text class="entry__count">{{ spares.length }}</text>
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 消耗品入口 -->
      <view class="entry" @tap="goConsumables">
        <view class="entry__icon entry__icon--green">耗</view>
        <view class="entry__info">
          <text class="entry__title">消耗品</text>
          <text class="entry__sub">直接消耗 · 即时领取</text>
        </view>
        <view class="entry__right">
          <text class="entry__count">{{ consumables.length }}</text>
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 物料领用入口（游客隐藏） -->
      <view class="entry" v-if="!auth.isGuest" @tap="goDispense">
        <view class="entry__icon entry__icon--orange">领</view>
        <view class="entry__info">
          <text class="entry__title">物料领用</text>
          <text class="entry__sub">备件提交工单 · 消耗品即时领取</text>
        </view>
        <view class="entry__right">
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 安全防护用品入口 -->
      <view class="entry" @tap="goSafety">
        <view class="entry__icon entry__icon--red">防</view>
        <view class="entry__info">
          <text class="entry__title">安全防护用品</text>
          <text class="entry__sub">台账录入 · 到期与定期检查提醒</text>
        </view>
        <view class="entry__right">
          <text class="entry__arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSpareParts, getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import { useAuthStore } from '@/store/auth'
import type { SparePart, Consumable } from '@/types'

const spares = ref<SparePart[]>([])
const consumables = ref<Consumable[]>([])
const loaded = ref(false)
const auth = useAuthStore()

function isLow(c: Consumable): boolean {
  if (c.warning_qty == null) return false
  return (c.stock_qty ?? 0) <= c.warning_qty
}

const lowCount = computed(
  () =>
    spares.value.filter((s) => (s as any).is_low_stock).length +
    consumables.value.filter(isLow).length
)

function goSpares() {
  uni.navigateTo({ url: '/pages/material/SparePartList' })
}

function goConsumables() {
  uni.navigateTo({ url: '/pages/material/ConsumableList' })
}

function goDispense() {
  uni.navigateTo({ url: '/pages/material/MaterialDispense' })
}

function goSafety() {
  uni.navigateTo({ url: '/pages/material/SafetySupplies' })
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 32rpx;
  }

  &__dispense {
    font-size: 26rpx;
    color: $tm-success;
    font-weight: 500;
  }
}

.summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 20rpx 0;
  font-size: 26rpx;
  color: $tm-text-secondary;

  &__item {
    &--warn {
      color: $tm-danger;
      font-weight: 600;
    }
  }

  &__sep {
    color: $tm-border;
  }
}

.entries {
  padding: 16rpx 24rpx;
  box-sizing: border-box;
}

.entry {
  display: flex;
  align-items: center;
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
  box-shadow: $tm-shadow-card;

  &__icon {
    width: 88rpx;
    height: 88rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 36rpx;
    font-weight: 600;
    margin-right: 24rpx;
    flex-shrink: 0;

    &--blue { background: $tm-primary; }
    &--green { background: $tm-success; }
    &--orange { background: $tm-warning; }
    &--red { background: $tm-danger; }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__title {
    font-size: 32rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__right {
    display: flex;
    align-items: center;
  }

  &__count {
    font-size: 36rpx;
    font-weight: 700;
    color: $tm-text-secondary;
    margin-right: 8rpx;
  }

  &__arrow {
    font-size: 40rpx;
    color: $tm-border;
  }
}
</style>
