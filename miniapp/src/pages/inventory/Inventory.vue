<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">盘库</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-show="checks.length">
      <view class="card" v-for="c in checks" :key="c.check_id" @tap="open(c)">
        <view class="card__top">
          <text class="card__no">{{ c.check_no }}</text>
          <text class="badge" :style="statusMeta(c.status).style">{{ statusMeta(c.status).label }}</text>
        </view>
        <view class="card__row">
          <text class="card__label">仓库</text>
          <text class="card__value">{{ c.warehouse_name || '—' }}</text>
        </view>
        <view class="card__row">
          <text class="card__label">开始时间</text>
          <text class="card__value">{{ formatTime(c.started_at) }}</text>
        </view>
        <view class="card__row" v-if="c.status === 'pending'">
          <text class="card__label">进度</text>
          <text class="card__value">{{ progress(c) }}</text>
        </view>
        <view class="card__row" v-else-if="c.completed_at">
          <text class="card__label">完成时间</text>
          <text class="card__value">{{ formatTime(c.completed_at) }}</text>
        </view>
        <view class="card__hint">{{ c.status === 'pending' ? '点击继续盘库 →' : '点击查看盘点结果 →' }}</view>
      </view>
    </scroll-view>

    <view class="empty" v-show="!checks.length">
      <text class="empty__text">{{ loaded ? '暂无盘点记录' : '加载中…' }}</text>
    </view>

    <view class="footer" v-if="!auth.isGuest">
      <view class="footer__row">
        <view class="footer__btn" @tap="goCreate">新建盘点</view>
        <view class="footer__btn footer__btn--secondary" @tap="goInbound">扫码入库</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getInventoryChecks } from '@/api/material'
import { useAuthStore } from '@/store/auth'
import { isItemEntered } from '@/composables/useInventoryEntered'

interface CheckItem {
  item_code: string
  actual_qty?: number
  system_qty?: number
  [key: string]: any
}
interface Check {
  check_id: number
  check_no: string
  warehouse_name?: string
  status: string
  started_at?: string
  completed_at?: string | null
  items?: CheckItem[]
}

const checks = ref<Check[]>([])
const loaded = ref(false)
const auth = useAuthStore()

function statusMeta(status: string) {
  const map: Record<string, { label: string; style: string }> = {
    pending: { label: '进行中', style: 'color:#f9a825;background:#fff8e1' },
    completed: { label: '已完成', style: 'color:#07c160;background:#e8f8ef' }
  }
  return map[status] || { label: status, style: 'color:#999;background:#f2f3f5' }
}

function formatTime(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 16)
}

/** 进度 X/Y：新模型以后端 counted 为准（旧单兼容本地标记） */
function progress(c: Check): string {
  const items = c.items || []
  if (!items.length) return '0/0'
  const done = items.filter((it) =>
    typeof it.counted === 'boolean' ? it.counted : isItemEntered(c.check_id, it as any)
  ).length
  return `${done}/${items.length}`
}

function open(c: Check) {
  const url = c.status === 'pending'
    ? `/pages/inventory/InventoryScan?id=${c.check_id}`
    : `/pages/inventory/InventoryResult?id=${c.check_id}`
  uni.navigateTo({ url })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/inventory/InventoryCreate' })
}

function goInbound() {
  uni.navigateTo({ url: '/pages/inventory/InboundScan' })
}

async function load() {
  loaded.value = false
  try {
    const data = await getInventoryChecks().catch(() => [])
    checks.value = (Array.isArray(data) ? data : data?.list || []) as Check[]
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

  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__refresh { font-size: 26rpx; color: $tm-primary; }
}

.list { flex: 1; padding: 16rpx 24rpx; box-sizing: border-box; }

.card {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $tm-shadow-card;

  &__top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14rpx; }
  &__no { font-size: 30rpx; font-weight: 600; color: $tm-text; }
  &__row { display: flex; align-items: center; margin-top: 8rpx; }
  &__label { width: 140rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__value { font-size: 26rpx; color: $tm-text-secondary; }
  &__hint { margin-top: 14rpx; font-size: 22rpx; color: $tm-primary; }
}

.badge { padding: 4rpx 16rpx; border-radius: 999rpx; font-size: 22rpx; }

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; }
}

.footer {
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: $tm-card-bg;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.04);

  &__row { display: flex; gap: 20rpx; }
  &__btn {
    flex: 1;
    text-align: center;
    padding: 22rpx 0;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 30rpx;
    font-weight: 600;

    &--secondary { background: $tm-success; }
  }
}
</style>
