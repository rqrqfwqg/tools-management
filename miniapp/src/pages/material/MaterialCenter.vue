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
      <text class="summary__item">备件 {{ spareCount }} 件</text>
      <text class="summary__sep">·</text>
      <text class="summary__item">消耗品 {{ consumables.length }} 种</text>
      <text class="summary__sep">·</text>
      <text class="summary__item summary__item--warn">低库存 {{ lowCount }}</text>
    </view>
    <view class="summary" v-else>加载中…</view>

    <view class="entries">
      <!-- 备件入口（序列化单品，一对一码） -->
      <view class="entry" @tap="goSpares">
        <view class="entry__icon entry__icon--blue">备</view>
        <view class="entry__info">
          <text class="entry__title">备件</text>
          <text class="entry__sub">单品管理 · 一对一二维码 · 多件同货位</text>
        </view>
        <view class="entry__right">
          <text class="entry__count">{{ spareCount }}</text>
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 消耗品入口（需工单 / 免工单 两种出库） -->
      <view class="entry" @tap="goConsumables">
        <view class="entry__icon entry__icon--green">耗</view>
        <view class="entry__info">
          <text class="entry__title">消耗品</text>
          <text class="entry__sub">需工单出库 / 免工单出库 两种</text>
        </view>
        <view class="entry__right">
          <text class="entry__count">{{ consumables.length }}</text>
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 标签打印入口（蓝牙逐个打印二维码标签） -->
      <view class="entry" @tap="goPrint">
        <view class="entry__icon entry__icon--cyan">印</view>
        <view class="entry__info">
          <text class="entry__title">标签打印</text>
          <text class="entry__sub">蓝牙连接精臣条码机 · 逐个打印二维码</text>
        </view>
        <view class="entry__right">
          <text class="entry__arrow">›</text>
        </view>
      </view>

      <!-- 物料领用入口（游客隐藏） -->
      <view class="entry" v-if="!auth.isGuest" @tap="goDispense">
        <view class="entry__icon entry__icon--orange">领</view>
        <view class="entry__info">
          <text class="entry__title">物料领用</text>
          <text class="entry__sub">备件单件借用 · 消耗品按出库类型</text>
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

      <!-- 库存盘点入口（仅物料管理员可见） -->
      <view class="entry" v-if="auth.isMaterialManager" @tap="goInventory">
        <view class="entry__icon entry__icon--purple">盘</view>
        <view class="entry__info">
          <text class="entry__title">库存盘点</text>
          <text class="entry__sub">扫码盘点备件单品与消耗品</text>
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
import { getSpareItems, getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import { useAuthStore } from '@/store/auth'
import type { SpareItem, Consumable } from '@/types'

const spareItems = ref<SpareItem[]>([])
const consumables = ref<Consumable[]>([])
const loaded = ref(false)
const auth = useAuthStore()

const spareCount = computed(() => spareItems.value.length)

function isLow(c: Consumable): boolean {
  if (c.warning_qty == null) return false
  return (c.stock_qty ?? 0) <= c.warning_qty
}

const lowCount = computed(() => consumables.value.filter(isLow).length)

function goSpares() {
  uni.navigateTo({ url: '/pages/material/SparePartList' })
}
function goConsumables() {
  uni.navigateTo({ url: '/pages/material/ConsumableList' })
}
function goPrint() {
  uni.navigateTo({ url: '/pages/print/PrinterLabel' })
}
function goDispense() {
  uni.navigateTo({ url: '/pages/material/MaterialDispense' })
}
function goSafety() {
  uni.navigateTo({ url: '/pages/material/SafetySupplies' })
}
function goInventory() {
  uni.navigateTo({ url: '/pages/inventory/Inventory' })
}

async function load() {
  loaded.value = false
  try {
    const [sp, co] = await Promise.all([
      getSpareItems().catch(() => []),
      getConsumables().catch(() => [])
    ])
    spareItems.value = toArray(sp) as SpareItem[]
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
    &--purple { background: #7c4dff; }
    &--cyan { background: #0096c7; }
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
