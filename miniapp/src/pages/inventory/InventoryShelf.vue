<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">货架导航</text>
      <text class="bar__sub">{{ check?.warehouse_name || '' }}</text>
    </view>

    <view class="tip">本仓库应盘物料参照清单（扫码录入请在盘点页进行）</view>

    <scroll-view scroll-y class="list" v-show="groups.length">
      <view class="group" v-for="g in groups" :key="g.title">
        <view class="group__title">{{ g.title }}（{{ g.items.length }}）</view>
        <view class="item" v-for="it in g.items" :key="g.title + it.item_code">
          <view class="item__main">
            <text class="item__name">{{ it.item_name }}</text>
            <text class="item__code">{{ it.item_code }}</text>
          </view>
          <view class="item__side">
            <text class="item__qty">{{ it.system_qty }} 件</text>
            <text class="item__loc">{{ it.location || it.warehouse || '' }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-show="!groups.length">
      <text class="empty__text">{{ loaded ? '暂无应盘物料' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInventoryCheckById } from '@/api/material'
import { getSpareParts, getConsumables } from '@/api/material'
import { toArray } from '@/utils/status'

const checkId = ref(0)
const check = ref<any>(null)
const loaded = ref(false)
const spareItems = ref<any[]>([])
const consItems = ref<any[]>([])

const groups = computed(() => {
  const out: Array<{ title: string; items: any[] }> = []
  if (spareItems.value.length) out.push({ title: '备件', items: spareItems.value })
  if (consItems.value.length) out.push({ title: '消耗品', items: consItems.value })
  return out
})

onLoad(async (options) => {
  checkId.value = Number(options?.id || 0)
  if (checkId.value) await load()
})

async function load() {
  loaded.value = false
  try {
    check.value = await getInventoryCheckById(checkId.value).catch(() => null)
    const whId = check.value?.warehouse_id
    if (whId) {
      const [sp, co] = await Promise.all([
        getSpareParts().catch(() => []),
        getConsumables().catch(() => [])
      ])
      spareItems.value = (toArray(sp) as any[]).filter((s) => s.warehouse_id === whId).map((s) => ({
        item_name: s.spare_name || s.spare_code,
        item_code: s.spare_code,
        system_qty: s.stock_qty ?? 0,
        warehouse: s.warehouse_name || '',
        location: s.location_name || s.shelf_name || ''
      }))
      consItems.value = (toArray(co) as any[]).filter((c) => c.warehouse_id === whId).map((c) => ({
        item_name: c.consumable_name || c.consumable_code,
        item_code: c.consumable_code,
        system_qty: c.stock_qty ?? 0,
        warehouse: c.warehouse_name || '',
        location: c.location_name || c.shelf_name || ''
      }))
    }
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
  &__sub { font-size: 24rpx; color: $tm-text-secondary; }
}

.tip {
  padding: 16rpx 32rpx;
  font-size: 22rpx;
  color: $tm-text-muted;
  background: $tm-card-bg;
}

.list { flex: 1; padding: 16rpx 24rpx 40rpx; box-sizing: border-box; }

.group__title { margin: 20rpx 8rpx 12rpx; font-size: 28rpx; font-weight: 600; color: $tm-text; }

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 20rpx 26rpx;
  margin-bottom: 12rpx;
  box-shadow: $tm-shadow-card;

  &__main { display: flex; flex-direction: column; min-width: 0; }
  &__name { font-size: 27rpx; font-weight: 500; color: $tm-text; }
  &__code { margin-top: 4rpx; font-size: 22rpx; color: $tm-text-muted; }
  &__side { display: flex; flex-direction: column; align-items: flex-end; }
  &__qty { font-size: 26rpx; font-weight: 600; color: $tm-text; }
  &__loc { margin-top: 4rpx; font-size: 20rpx; color: $tm-text-muted; }
}

.empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  &__text { font-size: 26rpx; color: $tm-text-muted; }
}
</style>
