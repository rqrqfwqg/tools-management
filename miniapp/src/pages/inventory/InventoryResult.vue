<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">盘点结果</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <template v-if="check">
      <!-- 汇总 -->
      <view class="summary">
        <view class="summary__row">
          <text class="summary__label">盘点单</text>
          <text class="summary__value">{{ check.check_no }}</text>
        </view>
        <view class="summary__row">
          <text class="summary__label">仓库</text>
          <text class="summary__value">{{ check.warehouse_name || '—' }}</text>
        </view>
        <view class="summary__row">
          <text class="summary__label">状态</text>
          <text class="summary__value" :style="check.status === 'completed' ? 'color:#07c160' : 'color:#f9a825'">
            {{ check.status === 'completed' ? '已完成' : '进行中' }}
          </text>
        </view>
        <view class="summary__row">
          <text class="summary__label">差异项</text>
          <text class="summary__value" :style="diffCount > 0 ? 'color:#ee0a24' : 'color:#07c160'">
            {{ diffCount }} 项
          </text>
        </view>
      </view>

      <!-- 明细 -->
      <view class="section-title">盘点明细（{{ (check.items || []).length }}）</view>
      <scroll-view scroll-y class="list">
        <view class="item" v-for="it in check.items || []" :key="it.item_code">
          <view class="item__head">
            <text class="item__name">{{ it.item_name }}</text>
            <text class="type-tag" :class="it.item_type === 'spare' ? 'type-tag--spare' : 'type-tag--cons'">
              {{ it.item_type === 'spare' ? '备件' : '消耗品' }}
            </text>
          </view>
          <view class="item__code">{{ it.item_code }}</view>
          <view class="item__row">
            <text class="item__cell">系统 {{ it.system_qty }}</text>
            <text class="item__cell">实盘 {{ it.actual_qty ?? 0 }}</text>
            <text class="item__diff" :class="{ 'item__diff--neg': diffOf(it) < 0, 'item__diff--pos': diffOf(it) > 0 }">
              差异 {{ diffOf(it) > 0 ? '+' : '' }}{{ diffOf(it) }}
            </text>
          </view>
        </view>
      </scroll-view>
    </template>

    <view class="empty" v-else>
      <text class="empty__text">{{ loaded ? '未找到盘点单' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInventoryCheckById } from '@/api/material'

const checkId = ref(0)
const check = ref<any>(null)
const loaded = ref(false)

const diffCount = computed(() =>
  (check.value?.items || []).filter((it: any) => diffOf(it) !== 0).length
)

function diffOf(it: any): number {
  return Number(it.diff ?? (Number(it.actual_qty ?? 0) - Number(it.system_qty ?? 0)))
}

onLoad(async (options) => {
  checkId.value = Number(options?.id || 0)
  if (checkId.value) await load()
})

async function load() {
  loaded.value = false
  try {
    check.value = await getInventoryCheckById(checkId.value).catch(() => null)
  } finally {
    loaded.value = true
  }
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
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__refresh { font-size: 26rpx; color: $tm-primary; }
}

.summary {
  margin: 20rpx 24rpx 0;
  background: $tm-card-bg;
  border-radius: $tm-radius;
  padding: 24rpx 28rpx;
  box-shadow: $tm-shadow-card;

  &__row { display: flex; align-items: center; margin-top: 10rpx; }
  &__label { width: 140rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__value { font-size: 26rpx; color: $tm-text; }
}

.section-title { margin: 28rpx 32rpx 12rpx; font-size: 28rpx; font-weight: 600; color: $tm-text; }

.list { flex: 1; padding: 0 24rpx 40rpx; box-sizing: border-box; }

.item {
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 20rpx 26rpx;
  margin-bottom: 12rpx;
  box-shadow: $tm-shadow-card;

  &__head { display: flex; align-items: center; gap: 12rpx; }
  &__name { flex: 1; font-size: 27rpx; font-weight: 500; color: $tm-text; }
  &__code { margin-top: 4rpx; font-size: 22rpx; color: $tm-text-muted; }
  &__row { display: flex; align-items: center; justify-content: space-between; margin-top: 12rpx; }
  &__cell { font-size: 24rpx; color: $tm-text-secondary; }
  &__diff {
    font-size: 26rpx;
    font-weight: 600;
    color: $tm-text-muted;
    &--neg { color: $tm-danger; }
    &--pos { color: $tm-success; }
  }
}

.type-tag {
  padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx;
  &--spare { color: $tm-primary; background: $tm-primary-bg; }
  &--cons { color: $tm-success; background: #e8f8ef; }
}

.empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; }
}
</style>
