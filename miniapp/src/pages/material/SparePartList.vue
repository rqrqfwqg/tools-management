<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">备件（{{ items.length }} 件）</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <view class="search">
      <input
        class="search__input"
        v-model="keyword"
        placeholder="搜索名称 / 编码"
        confirm-type="search"
        @confirm="load"
      />
    </view>

    <scroll-view scroll-y class="list" v-if="groups.length">
      <block v-for="g in groups" :key="g.storage_location_id">
        <view class="group__head">
          <text class="group__name">{{ g.location_name || g.storage_location || ('货位#' + g.storage_location_id) }}</text>
          <text class="group__meta" v-if="g.warehouse_name || g.shelf_name">
            {{ [g.warehouse_name, g.shelf_name].filter(Boolean).join(' · ') }}
          </text>
          <text class="group__count">{{ g.items.length }} 件</text>
        </view>

        <view class="card" v-for="s in g.items" :key="'si' + s.item_id">
          <view class="card__thumb card__thumb--text">{{ (s.spare_name || s.item_code).charAt(0) }}</view>
          <view class="card__main">
            <text class="card__name">{{ s.spare_name || s.item_code }}</text>
            <text class="card__code">{{ s.item_code }}</text>
            <text class="card__loc" v-if="s.category_name">{{ s.category_name }}</text>
          </view>
          <view class="card__side">
            <text class="status" :class="'status--' + s.status">{{ SPARE_ITEM_STATUS_TEXT[s.status] || s.status }}</text>
            <text class="print" @tap.stop="print(s)">打印</text>
          </view>
        </view>
      </block>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__text">{{ loaded ? '暂无备件单品' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSpareItems } from '@/api/material'
import { toArray } from '@/utils/status'
import { SPARE_ITEM_STATUS_TEXT } from '@/constants/material'
import type { SpareItem, SpareItemGroup } from '@/types'

const items = ref<SpareItem[]>([])
const keyword = ref('')
const loaded = ref(false)

const groups = computed<SpareItemGroup[]>(() => {
  const map = new Map<number, SpareItemGroup>()
  for (const s of items.value) {
    const id = s.storage_location_id ?? -1
    if (!map.has(id)) {
      map.set(id, {
        storage_location_id: id,
        location_name: s.location_name,
        storage_location: s.storage_location,
        shelf_name: s.shelf_name,
        warehouse_name: s.warehouse_name,
        items: []
      })
    }
    map.get(id)!.items.push(s)
  }
  return Array.from(map.values())
})

async function load() {
  loaded.value = false
  try {
    const data = await getSpareItems({ keyword: keyword.value || undefined }).catch(() => [])
    items.value = toArray(data) as SpareItem[]
  } finally {
    loaded.value = true
  }
}

function print(s: SpareItem) {
  uni.navigateTo({
    url:
      '/pages/print/PrinterLabel?kind=spare_item' +
      '&code=' + encodeURIComponent(s.item_code) +
      '&name=' + encodeURIComponent(s.spare_name || '')
  })
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

.search {
  padding: 16rpx 24rpx;
  background: $tm-card-bg;

  &__input {
    height: 72rpx;
    background: $tm-bg;
    border-radius: 36rpx;
    padding: 0 28rpx;
    font-size: 28rpx;
    color: $tm-text;
  }
}

.list {
  flex: 1;
  padding: 16rpx 24rpx 40rpx;
  box-sizing: border-box;
}

.group__head {
  display: flex;
  align-items: center;
  padding: 20rpx 8rpx 12rpx;
}

.group__name {
  font-size: 28rpx;
  font-weight: 600;
  color: $tm-text;
}

.group__meta {
  margin-left: 12rpx;
  font-size: 22rpx;
  color: $tm-text-muted;
}

.group__count {
  margin-left: auto;
  font-size: 22rpx;
  color: $tm-text-secondary;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $tm-card-bg;
  border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx;
  margin-bottom: 14rpx;
  box-shadow: $tm-shadow-card;

  &__thumb {
    width: 80rpx;
    height: 80rpx;
    border-radius: $tm-radius-sm;
    margin-right: 20rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $tm-primary-bg;
    color: $tm-primary;
    font-size: 32rpx;
    font-weight: 600;
  }

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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__code {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__loc {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }
}

.card__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 12rpx;
}

.status {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;

  &--in_stock { color: $tm-success; background: $tm-success-bg; }
  &--borrowed { color: $tm-warning; background: $tm-warning-bg; }
  &--out { color: $tm-text-muted; background: $tm-border-light; }
  &--scrapped { color: $tm-danger; background: $tm-danger-bg; }
}

.print {
  font-size: 24rpx;
  color: $tm-primary;
  padding: 4rpx 18rpx;
  border: 1rpx solid $tm-primary;
  border-radius: 999rpx;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  &__text {
    font-size: 26rpx;
    color: $tm-text-muted;
  }
}
</style>
