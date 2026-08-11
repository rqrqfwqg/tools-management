<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">库存明细</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list">
      <view class="cell" v-for="m in list" :key="m.movement_id">
        <view class="cell__top">
          <text class="type" :style="{ color: typeMeta(m).color, background: typeMeta(m).bg }">{{ typeText(m) }}</text>
          <text class="cell__name">{{ m.item_name || m.item_code || '—' }}</text>
        </view>
        <view class="cell__meta">
          <text>{{ itemTypeText(m.item_type) }}</text>
          <text>数量 {{ m.qty }}</text>
          <text v-if="m.operator_name">· {{ m.operator_name }}</text>
        </view>
        <view class="cell__foot">
          <text class="cell__code">{{ m.item_code || '—' }}</text>
          <text class="cell__time">{{ formatTime(m.created_at) }}</text>
        </view>
        <view class="cell__remark" v-if="m.remark">备注：{{ m.remark }}</view>
      </view>
      <view class="tip" v-if="loaded && !list.length">暂无明细</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStockMovements } from '@/api/material'
import { toArray } from '@/utils/status'

const list = ref<any[]>([])
const loaded = ref(false)

function typeText(m: any): string {
  if (m.movement_type === 'in') return '入库'
  if (m.movement_type === 'out') return '出库'
  if (m.movement_type === 'adjust') return m.qty > 0 ? '盘盈' : '盘亏'
  return m.movement_type || '—'
}
function typeMeta(m: any) {
  if (m.movement_type === 'in') return { color: '#07c160', bg: '#e8f8ef' }
  if (m.movement_type === 'out') return { color: '#ee0a24', bg: '#ffebee' }
  return m.qty > 0 ? { color: '#1989fa', bg: '#e8f3ff' } : { color: '#f9a825', bg: '#fff8e1' }
}
function itemTypeText(t?: string): string {
  const map: Record<string, string> = { spare: '备件', consumable: '消耗品', tool: '工具' }
  return (t && map[t]) || t || '—'
}
function formatTime(ts?: string): string {
  if (!ts) return ''
  return String(ts).replace('T', ' ').slice(0, 16)
}

async function load() {
  loaded.value = false
  try {
    list.value = toArray(await getStockMovements({ limit: 200 }).catch(() => []))
  } finally {
    loaded.value = true
  }
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $tm-bg; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 32rpx; background: $tm-card-bg;
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__refresh { font-size: 26rpx; color: $tm-primary; }
}
.list { flex: 1; padding: 12rpx 24rpx 40rpx; box-sizing: border-box; }
.cell { background: $tm-card-bg; border-radius: $tm-radius-sm; padding: 22rpx 28rpx; margin-bottom: 16rpx; box-shadow: $tm-shadow-card;
  &__top { display: flex; align-items: center; gap: 16rpx; }
  &__name { font-size: 30rpx; color: $tm-text; font-weight: 500; }
  &__meta { margin-top: 10rpx; font-size: 24rpx; color: $tm-text-secondary; display: flex; gap: 20rpx; }
  &__foot { margin-top: 10rpx; display: flex; justify-content: space-between; font-size: 22rpx; color: $tm-text-muted; }
  &__remark { margin-top: 8rpx; font-size: 22rpx; color: $tm-warning; }
}
.type { padding: 2rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; flex-shrink: 0; }
.tip { padding: 48rpx 0; text-align: center; font-size: 26rpx; color: $tm-text-muted; }
</style>
