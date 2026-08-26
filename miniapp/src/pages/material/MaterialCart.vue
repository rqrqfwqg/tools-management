<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">物料购物车</text>
      <text class="bar__refresh" v-if="cart.items.length" @tap="clearAll">清空</text>
    </view>

    <scroll-view scroll-y class="list" v-show="cart.items.length">
      <view class="card" v-for="item in cart.items" :key="item.key">
        <view class="card__main">
          <text class="card__name">{{ item.name }}</text>
          <text class="card__code">{{ item.code }}</text>
          <text class="card__stock" :class="{ 'card__stock--low': item.stock <= item.qty && item.qty >= item.stock }">
            库存 {{ item.stock }}{{ item.unit }}
          </text>
        </view>
        <view class="card__side">
          <view class="stepper">
            <view class="stepper__btn" @tap="dec(item)">−</view>
            <text class="stepper__val">{{ item.qty }}</text>
            <view class="stepper__btn" @tap="inc(item)">＋</view>
          </view>
          <text class="card__del" @tap="cart.removeItem(item.key)">删除</text>
        </view>
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

      <view class="notice">备件单品逐一借用（一对一码）；消耗品按出库类型：需工单提交工单、免工单直接扣库存</view>

      <view class="submit" :class="{ 'submit--disabled': submitting }" @tap="checkout">
        {{ submitting ? '提交中…' : '提交领用' }}
      </view>
    </scroll-view>

    <view class="empty" v-show="!cart.items.length">
      <text class="empty__icon">料</text>
      <text class="empty__text">物料购物车为空</text>
      <view class="empty__btn" @tap="goDispense">去挑选物料</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMaterialCartStore } from '@/store/materialCart'
import { useAuthStore } from '@/store/auth'
import { outboundConsumable } from '@/api/material'
import { showToast, showModal } from '@/utils/feedback'
import { requestSubscribe } from '@/composables/useWxSubscribe'
import type { MaterialCartItem } from '@/store/materialCart'

const cart = useMaterialCartStore()
const authStore = useAuthStore()
const user = computed(() => authStore.user)
const submitting = ref(false)

function clearAll() {
  showModal({ title: '清空购物车', content: '确定清空已选物料？' }).then((ok) => {
    if (ok) cart.clearAll()
  })
}

function inc(item: MaterialCartItem) {
  const next = cart.addItem(item, 1)
  if (next >= item.stock) {
    showToast(`最多可领 ${item.stock}${item.unit}`, 'none')
  }
}

function dec(item: MaterialCartItem) {
  cart.setQty(item.key, item.qty - 1)
}

async function checkout() {
  if (!cart.items.length) {
    showToast('购物车为空', 'none')
    return
  }
  if (authStore.isGuest) {
    showToast('游客模式仅可查看，请用手机号登录', 'none')
    return
  }
  // 备件单品：逐件借用（一对一码，每件 1 实物）
  const spareItems = cart.items.filter((i) => i.type === 'spare_item')
  // 消耗品：按出库类型分流（需工单建单 / 免工单直领）
  const consItems = cart.items.filter((i) => i.type === 'cons')

  submitting.value = true
  try {
    let msg = ''
    if (spareItems.length) {
      // 后端暂未实现备件单品借出专属端点（materials.js 无 /spare-items/code/:code/borrow）。
      // 小程序端暂不支持单件直接借出，引导网页端办理；此处不调用会 404 的接口，避免整单失败。
      msg = `${spareItems.length} 件备件单品请到网页端办理借出`
    }
    if (consItems.length) {
      try {
        await Promise.all(
          consItems.map((c) =>
            outboundConsumable(c.code, c.qty, c.outboundType || 'direct')
          )
        )
      } catch (e: any) {
        // 需工单(require_order=true)调 /take 会被后端拦截返回 400，给出明确提示
        const blocked = consItems.filter((c) => c.outboundType === 'workorder').length
        if (blocked) {
          await showToast(`需工单的 ${blocked} 项请走物料领用单办理`, 'none')
        } else {
          await showToast(e?.data?.message || e?.message || '消耗品出库失败', 'none')
        }
        submitting.value = false
        return
      }
      const wo = consItems.filter((c) => c.outboundType === 'workorder').length
      const di = consItems.length - wo
      const parts: string[] = []
      if (wo) parts.push(`${wo} 项需工单已提交`)
      if (di) parts.push(`${di} 项免工单已领取`)
      msg = msg ? `${msg}；${parts.join('，')}` : parts.join('，')
    }
    cart.clearAll()
    await showToast(msg, 'success')
    // 领用成功后请求订阅授权（续期），保证后续「领用成功 / 未归还提醒」能送达
    requestSubscribe('both', true)
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '提交失败', 'none')
  } finally {
    submitting.value = false
  }
}

function goDispense() {
  uni.navigateTo({ url: '/pages/material/MaterialDispense' })
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
  padding: 24rpx 28rpx;
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

  &__stock {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;

    &--low {
      color: $tm-danger;
    }
  }

  &__side {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  &__del {
    font-size: 26rpx;
    color: $tm-danger;
    padding: 8rpx;
  }
}

.stepper {
  display: flex;
  align-items: center;
  gap: 16rpx;

  &__btn {
    width: 56rpx;
    height: 56rpx;
    line-height: 52rpx;
    text-align: center;
    border-radius: $tm-radius-sm;
    background: $tm-primary-bg;
    color: $tm-primary;
    font-size: 36rpx;
  }

  &__val {
    min-width: 48rpx;
    text-align: center;
    font-size: 30rpx;
    font-weight: 600;
    color: $tm-text;
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
