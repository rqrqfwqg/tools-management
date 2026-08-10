<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">工具列表</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-if="tools.length">
      <view class="card" v-for="t in tools" :key="t.tool_id" @tap="onTap(t)">
        <view class="card__main">
          <text class="card__name">{{ t.tool_name || t.tool_code }}</text>
          <text class="card__code">{{ t.tool_code }}</text>
        </view>
        <view class="card__side">
          <text class="badge" :style="{ color: meta(t.status).color, background: meta(t.status).bg }">
            {{ meta(t.status).label }}
          </text>
          <text class="card__loc" v-if="t.location_name || t.warehouse">{{ t.location_name || t.warehouse }}</text>
          <view v-if="t.status === 'available'" class="card__btn" @tap.stop="addToCart(t)">领用</view>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__icon">工</text>
      <text class="empty__text">{{ loaded ? '暂无工具数据' : '加载中…' }}</text>
    </view>

    <!-- 底部领用篮（仅选中有工具时显示） -->
    <view class="cart-bar" v-if="cartStore.count > 0" @tap="goCart">
      <view class="cart-bar__info">
        <text class="cart-bar__dot">{{ cartStore.count }}</text>
        <text class="cart-bar__text">已选 {{ cartStore.count }} 件工具</text>
      </view>
      <view class="cart-bar__btn">去领用</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getTools } from '@/api'
import { toolStatusMeta, toArray } from '@/utils/status'
import { useCartStore } from '@/store/cart'
import type { Tool } from '@/types'

const tools = ref<Tool[]>([])
const loaded = ref(false)
const cartStore = useCartStore()

function meta(status?: string) {
  return toolStatusMeta(status)
}

async function load() {
  loaded.value = false
  try {
    const data = await getTools().catch(() => [])
    tools.value = toArray(data) as Tool[]
  } finally {
    loaded.value = true
  }
}

function onTap(t: Tool) {
  uni.showToast({ title: `${t.tool_name || t.tool_code}\n状态：${meta(t.status).label}`, icon: 'none' })
}

function addToCart(t: Tool) {
  cartStore.addItem({
    tool_id: t.tool_id,
    tool_name: t.tool_name || t.tool_code,
    tool_code: t.tool_code,
    warehouse: t.warehouse || t.location_name || ''
  })
  uni.showToast({ title: '已加入领用篮', icon: 'success' })
}

function goCart() {
  uni.navigateTo({ url: '/pages/cart/ShoppingCart' })
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
  padding: 16rpx 24rpx 120rpx;
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

  &__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__loc {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }

  &__btn {
    margin-top: 12rpx;
    padding: 6rpx 24rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 24rpx;
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

.cart-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: $tm-card-bg;
  border-top: 1rpx solid $tm-border;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);

  &__info {
    display: flex;
    align-items: center;
  }

  &__dot {
    min-width: 40rpx;
    height: 40rpx;
    line-height: 40rpx;
    text-align: center;
    border-radius: 999rpx;
    background: $tm-danger;
    color: #ffffff;
    font-size: 24rpx;
    margin-right: 16rpx;
  }

  &__text {
    font-size: 28rpx;
    color: $tm-text;
  }

  &__btn {
    padding: 14rpx 40rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
  }
}
</style>
