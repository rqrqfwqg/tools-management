<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">流水筛选</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-x class="filters" :show-scrollbar="false">
      <view
        v-for="opt in FILTERS"
        :key="opt.key"
        class="filter"
        :class="{ 'filter--on': current === opt.key }"
        @tap="current = opt.key"
      >{{ opt.label }}</view>
    </scroll-view>

    <scroll-view scroll-y class="list">
      <view class="cell" v-for="m in filteredList" :key="m.movement_id">
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
      </view>
      <view class="tip" v-if="loaded && !filteredList.length">无符合条件记录</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStockMovements } from '@/api/material'
import { toArray } from '@/utils/status'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'in', label: '入库' },
  { key: 'out', label: '出库' },
  { key: 'profit', label: '盘盈' },
  { key: 'loss', label: '盘亏' }
]

const list = ref<any[]>([])
const loaded = ref(false)
const current = ref('all')

const filteredList = computed(() => {
  const key = current.value
  if (key === 'all') return list.value
  return list.value.filter((m) => {
    if (key === 'in') return m.movement_type === 'in'
    if (key === 'out') return m.movement_type === 'out'
    if (key === 'profit') return m.movement_type === 'adjust' && m.qty > 0
    if (key === 'loss') return m.movement_type === 'adjust' && m.qty < 0
    return true
  })
})

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
.filters { white-space: nowrap; padding: 16rpx 24rpx 4rpx;
  .filter { display: inline-block; padding: 10rpx 28rpx; margin-right: 16rpx; border-radius: 999rpx; background: $tm-card-bg;
    color: $tm-text-secondary; font-size: 24rpx;
    &--on { background: $tm-primary; color: #fff; font-weight: 600; }
  }
}
.list { flex: 1; padding: 12rpx 24rpx 40rpx; box-sizing: border-box; }
.cell { background: $tm-card-bg; border-radius: $tm-radius-sm; padding: 22rpx 28rpx; margin-bottom: 16rpx; box-shadow: $tm-shadow-card;
  &__top { display: flex; align-items: center; gap: 16rpx; }
  &__name { font-size: 30rpx; color: $tm-text; font-weight: 500; }
  &__meta { margin-top: 10rpx; font-size: 24rpx; color: $tm-text-secondary; display: flex; gap: 20rpx; }
  &__foot { margin-top: 10rpx; display: flex; justify-content: space-between; font-size: 22rpx; color: $tm-text-muted; }
}
.type { padding: 2rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; flex-shrink: 0; }
.tip { padding: 48rpx 0; text-align: center; font-size: 26rpx; color: $tm-text-muted; }
</style>
