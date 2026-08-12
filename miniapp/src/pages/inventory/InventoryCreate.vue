<template>
  <view class="page">
    <!-- 进行中的盘库单（可继续） -->
    <view class="section" v-if="pendingChecks.length">
      <view class="section-title">继续未完成盘库单</view>
      <view class="pending" v-for="c in pendingChecks" :key="c.check_id" @tap="resume(c)">
        <view class="pending__main">
          <text class="pending__no">{{ c.check_no }}</text>
          <text class="pending__sub">{{ c.warehouse_name || '' }} · {{ formatTime(c.started_at) }}</text>
        </view>
        <text class="pending__arrow">继续 ›</text>
      </view>
    </view>

    <!-- 选择仓库 -->
    <view class="section">
      <view class="section-title">{{ pendingChecks.length ? '或新建盘库单' : '选择仓库' }}</view>
      <view
        class="wh"
        v-for="w in warehouses"
        :key="w.warehouse_id"
        :class="{ 'wh--on': selectedId === w.warehouse_id }"
        @tap="select(w)"
      >
        <view class="wh__main">
          <text class="wh__name">{{ w.warehouse_name }}</text>
          <text class="wh__code">{{ w.warehouse_code }}</text>
        </view>
        <view class="wh__check" v-if="selectedId === w.warehouse_id">
          <text class="wh__check-mark">✓</text>
        </view>
      </view>
      <view class="empty-tip" v-if="loaded && !warehouses.length">暂无可用仓库</view>
    </view>

    <!-- 操作 -->
    <view class="footer">
      <view class="footer__btn" :class="{ 'footer__btn--disabled': !selectedId || creating }" @tap="create">
        {{ creating ? '创建中…' : '开始盘点' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getWarehouses } from '@/api'
import { getInventoryChecks, createInventoryCheck } from '@/api/material'
import { showToast } from '@/utils/feedback'

const warehouses = ref<any[]>([])
const pendingChecks = ref<any[]>([])
const selectedId = ref<number | null>(null)
const loaded = ref(false)
const creating = ref(false)

function formatTime(s?: string): string {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 16)
}

function select(w: any) {
  selectedId.value = w.warehouse_id
}

function resume(c: any) {
  uni.navigateTo({ url: `/pages/inventory/InventoryScan?id=${c.check_id}` })
}

async function create() {
  if (!selectedId.value || creating.value) return
  creating.value = true
  try {
    const check = await createInventoryCheck({ warehouse_id: selectedId.value })
    uni.redirectTo({ url: `/pages/inventory/InventoryScan?id=${check.check_id}` })
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '创建失败', 'none')
  } finally {
    creating.value = false
  }
}

onShow(async () => {
  loaded.value = false
  try {
    const [whs, checks] = await Promise.all([
      getWarehouses().catch(() => []),
      getInventoryChecks().catch(() => [])
    ])
    warehouses.value = Array.isArray(whs) ? whs : []
    const list = Array.isArray(checks) ? checks : checks?.list || []
    pendingChecks.value = list.filter((c: any) => c.status === 'pending')
  } finally {
    loaded.value = true
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  padding: 24rpx;
  box-sizing: border-box;
}

.section-title {
  margin: 20rpx 8rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.pending {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &__main { display: flex; flex-direction: column; }
  &__no { font-size: 30rpx; font-weight: 600; color: $tm-text; }
  &__sub { margin-top: 6rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__arrow { font-size: 26rpx; color: $tm-primary; }
}

.wh {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 26rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;
  border: 2rpx solid transparent;

  &--on {
    border-color: $tm-primary;
    background: $tm-primary-bg;
  }

  &__main { display: flex; flex-direction: column; }
  &__name { font-size: 30rpx; font-weight: 600; color: $tm-text; }
  &__code { margin-top: 6rpx; font-size: 24rpx; color: $tm-text-muted; }

  &__check {
    width: 44rpx; height: 44rpx; border-radius: 50%;
    background: $tm-primary;
    display: flex; align-items: center; justify-content: center;
  }
  &__check-mark { color: #ffffff; font-size: 28rpx; }
}

.empty-tip { padding: 20rpx 8rpx; font-size: 24rpx; color: $tm-text-muted; }

.footer {
  margin-top: 40rpx;
  padding-bottom: env(safe-area-inset-bottom);

  &__btn {
    text-align: center;
    padding: 22rpx 0;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;

    &--disabled { background: $tm-border; color: #ffffff; }
  }
}
</style>
