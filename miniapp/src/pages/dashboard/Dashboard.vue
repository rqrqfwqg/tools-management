<template>
  <view class="page">
    <!-- 顶部欢迎 -->
    <view class="header">
      <image v-if="avatar" class="header__avatar" :src="avatar" mode="aspectFill" />
      <view v-else class="header__avatar header__avatar--text">{{ avatarText }}</view>
      <view class="header__info">
        <view class="header__hello">{{ greeting }}</view>
        <view class="header__sub">{{ roleName }}<text v-if="deptName"> · {{ deptName }}</text></view>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats">
      <view class="stats__item" @tap="goTab('tools')">
        <text class="stats__num">{{ stats.tools }}</text>
        <text class="stats__label">工具</text>
      </view>
      <view class="stats__item" @tap="goTab('orders')">
        <text class="stats__num">{{ stats.orders }}</text>
        <text class="stats__label">工单</text>
      </view>
      <view class="stats__item" @tap="goTab('material')">
        <text class="stats__num">{{ stats.spare + stats.consumable }}</text>
        <text class="stats__label">物料</text>
      </view>
      <view class="stats__item stats__item--warn" @tap="goTab('material')">
        <text class="stats__num">{{ stats.lowStock }}</text>
        <text class="stats__label">低库存</text>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="section-title">快捷入口</view>
    <view class="grid">
      <view class="grid__item" @tap="goTab('tools')">
        <view class="grid__icon grid__icon--blue">工</view>
        <text class="grid__text">工具管理</text>
      </view>
      <view class="grid__item" @tap="goTab('material')">
        <view class="grid__icon grid__icon--green">物</view>
        <text class="grid__text">物料中心</text>
      </view>
      <view class="grid__item" @tap="goTab('orders')">
        <view class="grid__icon grid__icon--orange">单</view>
        <text class="grid__text">领用工单</text>
      </view>
      <view class="grid__item" @tap="goScan">
        <view class="grid__icon grid__icon--purple">扫</view>
        <text class="grid__text">扫码</text>
      </view>
    </view>

    <!-- 已借出工具快捷入口 -->
    <view class="borrow-entry" @tap="goTab('orders')">
      <view class="borrow-entry__left">
        <view class="borrow-entry__icon">还</view>
        <view class="borrow-entry__info">
          <text class="borrow-entry__title">已借出工具</text>
          <text class="borrow-entry__sub">归还前需逐件清点确认</text>
        </view>
      </view>
      <view class="borrow-entry__right">
        <text class="borrow-entry__count">{{ borrowedCount }}</text>
        <text class="borrow-entry__unit">件待归还</text>
        <text class="borrow-entry__arrow">›</text>
      </view>
    </view>

    <view class="tip" v-if="loaded && isEmpty">暂无数据，请先在管理后台录入工具 / 物料 / 工单。</view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'
import { getTools, getOrders } from '@/api'
import { getSpareParts, getConsumables, getLowStockConsumables } from '@/api/material'
import { toArray } from '@/utils/status'
import { refreshOrderBadge } from '@/composables/useOrderBadge'

const auth = useAuthStore()
const loaded = ref(false)
const stats = ref({ tools: 0, orders: 0, spare: 0, consumable: 0, lowStock: 0 })
/** 已借出（借出中/已批准）工单中未归还的物品件数 */
const borrowedCount = ref(0)

const avatar = computed(() => auth.user?.wx_avatar || '')
const greeting = computed(() => {
  const u = auth.user
  const name = u?.real_name || u?.wx_nickname || '您好'
  return `你好，${name}`
})
const roleName = computed(() => auth.user?.role_name || roleLabel(auth.user?.role))
const deptName = computed(() => auth.user?.dept_name || '')
const avatarText = computed(() => {
  const u = auth.user
  const name = u?.real_name || u?.wx_nickname || 'U'
  return name.charAt(0)
})
const isEmpty = computed(
  () =>
    stats.value.tools === 0 &&
    stats.value.orders === 0 &&
    stats.value.spare === 0 &&
    stats.value.consumable === 0
)

function roleLabel(r?: string): string {
  const map: Record<string, string> = {
    admin: '管理员',
    team_leader: '班组长',
    material_manager: '物料管理员',
    staff: '员工'
  }
  return r ? map[r] || r : ''
}

async function load() {
  loaded.value = false
  try {
    const [tools, orders, spares, consumables, low] = await Promise.all([
      getTools().catch(() => []),
      getOrders().catch(() => []),
      getSpareParts().catch(() => []),
      getConsumables().catch(() => []),
      getLowStockConsumables().catch(() => [])
    ])
    stats.value = {
      tools: toArray(tools).length,
      orders: toArray(orders).length,
      spare: toArray(spares).length,
      consumable: toArray(consumables).length,
      lowStock: toArray(low).length
    }
    // 统计借出中/已批准工单的物品件数（待归还）
    const orderList = toArray(orders) as any[]
    borrowedCount.value = orderList
      .filter((o) => o.status === 'borrowed' || o.status === 'approved')
      .reduce((sum, o) => sum + ((o.items || []).length || 1), 0)
    // 刷新工单 tab 未处理角标（pending + borrowed，复用已拉取列表）
    refreshOrderBadge(orderList)
  } finally {
    loaded.value = true
  }
}

function goTab(tab: 'tools' | 'material' | 'orders') {
  const map: Record<string, string> = {
    tools: '/pages/tools/ToolManagement',
    material: '/pages/material/MaterialCenter',
    orders: '/pages/orders/OrderManagement'
  }
  uni.switchTab({ url: map[tab] })
}

function goScan() {
  uni.navigateTo({ url: '/pages/scan/ScanTool' })
}

onShow(() => {
  load()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  padding: 24rpx;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, $tm-primary, $tm-primary-dark);
  border-radius: $tm-radius;
  padding: 36rpx 32rpx;
  color: #fff;
  box-shadow: $tm-shadow-card;

  &__avatar {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    margin-right: 24rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.6);

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.25);
      font-size: 40rpx;
      font-weight: 600;
    }
  }

  &__info {
    flex: 1;
  }

  &__hello {
    font-size: 34rpx;
    font-weight: 600;
  }

  &__sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    opacity: 0.85;
  }
}

.stats {
  display: flex;
  margin-top: 24rpx;
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 28rpx 0;
  box-shadow: $tm-shadow-card;

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;

    &--warn .stats__num {
      color: $tm-danger;
    }
  }

  &__num {
    font-size: 44rpx;
    font-weight: 700;
    color: $tm-text;
  }

  &__label {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-secondary;
  }
}

.section-title {
  margin: 36rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 24rpx 0;
  box-shadow: $tm-shadow-card;

  &__item {
    width: 25%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16rpx 0;
  }

  &__icon {
    width: 88rpx;
    height: 88rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 36rpx;
    font-weight: 600;
    margin-bottom: 12rpx;

    &--blue { background: $tm-primary; }
    &--green { background: $tm-success; }
    &--orange { background: $tm-warning; }
    &--purple { background: #7c4dff; }
  }

  &__text {
    font-size: 24rpx;
    color: $tm-text-secondary;
  }
}

.tip {
  margin-top: 40rpx;
  text-align: center;
  font-size: 24rpx;
  color: $tm-text-muted;
}

.borrow-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  background: linear-gradient(135deg, $tm-warning, #ffb35c);
  border-radius: $tm-radius;
  padding: 28rpx 32rpx;
  box-shadow: $tm-shadow-card;

  &__left {
    display: flex;
    align-items: center;
  }

  &__icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.25);
    color: #ffffff;
    font-size: 32rpx;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20rpx;
  }

  &__info {
    display: flex;
    flex-direction: column;
  }

  &__title {
    font-size: 30rpx;
    font-weight: 600;
    color: #ffffff;
  }

  &__sub {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.85);
  }

  &__right {
    display: flex;
    align-items: baseline;
  }

  &__count {
    font-size: 44rpx;
    font-weight: 700;
    color: #ffffff;
  }

  &__unit {
    margin-left: 8rpx;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.9);
  }

  &__arrow {
    margin-left: 12rpx;
    font-size: 40rpx;
    color: rgba(255, 255, 255, 0.9);
  }
}
</style>
