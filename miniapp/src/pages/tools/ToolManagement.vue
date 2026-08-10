<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">工具列表</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list" v-if="tools.length">
      <view class="card" v-for="t in tools" :key="t.tool_id" @tap="onTap(t)">
        <view class="card__main">
          <text class="card__name">{{ t.tool_name || t.tool_code }}</text>
          <text class="card__code">{{ t.tool_code }}</text>
        </view>
        <view class="card__side">
          <text class="badge" :style="{ color: meta(t.status).color, background: meta(t.status).bg }">
            {{ meta(t.status).label }}
          </text>
          <text class="card__loc" v-if="t.location_name || t.warehouse">{{ t.location_name || t.warehouse }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__icon">工</text>
      <text class="empty__text">{{ loaded ? '暂无工具数据' : '加载中…' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getTools } from '@/api'
import { toolStatusMeta, toArray } from '@/utils/status'
import type { Tool } from '@/types'

const tools = ref<Tool[]>([])
const loaded = ref(false)

function meta(status?: string) {
  return toolStatusMeta(status)
}

async function load() {
  loaded.value = false
  try {
    const data = await getTools().catch(() => [])
    tools.value = toArray(data) as Tool[]
  } finally {
    loaded.value = true
  }
}

function onTap(t: Tool) {
  uni.showToast({ title: `${t.tool_name || t.tool_code}\n状态：${meta(t.status).label}`, icon: 'none' })
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

.list {
  flex: 1;
  padding: 16rpx 24rpx;
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

  &__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__loc {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }
}

.badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
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
}
</style>
