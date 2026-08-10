<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">领用篮</text>
      <text class="bar__refresh" v-if="cartStore.items.length" @tap="clearAll">清空</text>
    </view>

    <scroll-view scroll-y class="list" v-if="cartStore.items.length">
      <view class="card" v-for="item in cartStore.items" :key="item.tool_id">
        <view class="card__main">
          <text class="card__name">{{ item.tool_name }}</text>
          <text class="card__code">{{ item.tool_code }}</text>
          <text class="card__loc" v-if="item.warehouse">{{ item.warehouse }}</text>
        </view>
        <text class="card__del" @tap="cartStore.removeItem(item.tool_id)">删除</text>
      </view>

      <!-- 领用人信息（自动使用当前登录账号） -->
      <view class="panel">
        <view class="row">
          <text class="row__label">领用人</text>
          <text class="row__value">{{ user?.real_name || user?.username || '—' }}</text>
        </view>
        <view class="row">
          <text class="row__label">手机号</text>
          <text class="row__value">{{ user?.phone || '—' }}</text>
        </view>
      </view>

      <view class="notice">提交后将进入审批流程，由管理员或分队长审批</view>

      <view class="submit" :class="{ 'submit--disabled': submitting }" @tap="checkout">
        {{ submitting ? '提交中…' : '提交领用申请' }}
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__icon">篮</text>
      <text class="empty__text">领用篮为空</text>
      <view class="empty__btn" @tap="goTools">去挑选工具</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '@/store/cart'
import { useAuthStore } from '@/store/auth'
import { createOrder } from '@/api'
import { showToast, showModal } from '@/utils/feedback'

const cartStore = useCartStore()
const authStore = useAuthStore()
const user = authStore.user
const submitting = ref(false)

function clearAll() {
  showModal({ title: '清空领用篮', content: '确定清空已选工具？' }).then((ok) => {
    if (ok) cartStore.clearAll()
  })
}

async function checkout() {
  if (!cartStore.items.length) {
    showToast('领用篮为空', 'none')
    return
  }
  submitting.value = true
  try {
    const tool_ids = cartStore.items.map((i) => i.tool_id)
    const warehouse = cartStore.items[0].warehouse || ''
    await createOrder({ tool_ids, warehouse })
    await showToast('申请已提交，等待审批', 'success')
    cartStore.clearAll()
    uni.switchTab({ url: '/pages/orders/OrderManagement' })
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  } finally {
    submitting.value = false
  }
}

function goTools() {
  uni.switchTab({ url: '/pages/tools/ToolManagement' })
}
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
    color: $tm-danger;
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

  &__del {
    font-size: 26rpx;
    color: $tm-danger;
    padding: 8rpx 8rpx 8rpx 24rpx;
  }
}

.panel {
  margin-top: 24rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 8rpx 28rpx;
  box-shadow: $tm-shadow-card;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $tm-border-light;

  &:last-child {
    border-bottom: none;
  }

  &__label {
    font-size: 26rpx;
    color: $tm-text-muted;
  }

  &__value {
    font-size: 28rpx;
    color: $tm-text;
  }
}

.notice {
  margin: 20rpx 8rpx;
  padding: 16rpx 24rpx;
  border-radius: $tm-radius-sm;
  background: #fff9c4;
  color: #b8860b;
  font-size: 24rpx;
}

.submit {
  margin-top: 12rpx;
  text-align: center;
  padding: 22rpx 0;
  background: $tm-primary;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 999rpx;

  &--disabled {
    opacity: 0.6;
  }
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

  &__btn {
    margin-top: 32rpx;
    padding: 14rpx 48rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
  }
}
</style>
