<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">工具列表</text>
      <text class="bar__refresh" @tap="load">刷新</text>
    </view>

    <!-- 搜索 -->
    <view class="search">
      <input
        v-model="keyword"
        class="search__input"
        placeholder="搜索名称/编码"
        placeholder-class="search__ph"
        confirm-type="search"
      />
    </view>

    <!-- 按货架筛选 -->
    <scroll-view scroll-x class="shelves" :show-scrollbar="false">
      <view
        class="shelves__item"
        :class="{ 'shelves__item--active': shelfId === 0 }"
        @tap="shelfId = 0"
      >全部</view>
      <view
        v-for="s in shelves"
        :key="s.shelf_id"
        class="shelves__item"
        :class="{ 'shelves__item--active': shelfId === s.shelf_id }"
        @tap="shelfId = s.shelf_id"
      >{{ s.shelf_name }}</view>
    </scroll-view>

    <scroll-view scroll-y class="list" v-if="filtered.length">
      <view class="card" v-for="t in filtered" :key="t.tool_id" @tap="onTap(t)">
        <image v-if="t.image_url" class="card__thumb" :src="resolveImage(t.image_url)" mode="aspectFill" />
        <view v-else class="card__thumb card__thumb--text">{{ (t.tool_name || t.tool_code).charAt(0) }}</view>
        <view class="card__main">
          <text class="card__name">{{ t.tool_name || t.tool_code }}</text>
          <text class="card__code">{{ t.tool_code }}</text>
          <text class="card__loc" v-if="t.shelf_name || t.warehouse || t.location_name">
            {{ [t.shelf_name, t.location_name, t.warehouse].filter(Boolean).join(' · ') }}
          </text>
        </view>
        <view class="card__side">
          <text class="badge" :style="{ color: meta(t.status).color, background: meta(t.status).bg }">
            {{ meta(t.status).label }}
          </text>
          <view
            v-if="t.status === 'available' && !auth.isGuest"
            class="card__btn"
            :class="{ 'card__btn--added': cartStore.hasItem(t.tool_id) }"
            @tap.stop="addToCart(t)"
          >
            {{ cartStore.hasItem(t.tool_id) ? '已加入' : '领用' }}
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="empty" v-else>
      <text class="empty__icon">工</text>
      <text class="empty__text">{{ loaded ? '没有符合条件的工具' : '加载中…' }}</text>
    </view>

    <!-- 底部领用篮（游客隐藏；仅选中有工具时显示） -->
    <view class="cart-bar" v-if="cartStore.count > 0 && !auth.isGuest" @tap="goCart">
      <view class="cart-bar__info">
        <text class="cart-bar__dot">{{ cartStore.count }}</text>
        <text class="cart-bar__text">已选 {{ cartStore.count }} 件工具</text>
      </view>
      <view class="cart-bar__btn">去领用</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getTools, getShelves } from '@/api'
import { toolStatusMeta, toArray } from '@/utils/status'
import { resolveImage } from '@/utils/image'
import { useCartStore } from '@/store/cart'
import { useAuthStore } from '@/store/auth'
import type { Tool } from '@/types'

const tools = ref<Tool[]>([])
const loaded = ref(false)
const cartStore = useCartStore()
const auth = useAuthStore()

// 搜索 + 货架筛选
const keyword = ref('')
const shelves = ref<any[]>([])
const shelfId = ref(0)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return tools.value.filter((t) => {
    if (shelfId.value !== 0 && t.shelf_id !== shelfId.value) return false
    if (!kw) return true
    const name = (t.tool_name || '').toLowerCase()
    const code = (t.tool_code || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

function meta(status?: string) {
  return toolStatusMeta(status)
}

async function load() {
  loaded.value = false
  try {
    const data = await getTools().catch(() => [])
    // 按使用次数（borrow_count）降序：常用工具优先展示
    tools.value = (toArray(data) as Tool[]).sort(
      (a, b) => (b.borrow_count || 0) - (a.borrow_count || 0)
    )
  } finally {
    loaded.value = true
  }
  // 货架列表首次加载后缓存（刷新工具不动货架）
  if (!shelves.value.length) {
    getShelves()
      .then((d) => {
        shelves.value = toArray(d)
      })
      .catch(() => {})
  }
}

function onTap(t: Tool) {
  uni.showToast({ title: `${t.tool_name || t.tool_code}\n状态：${meta(t.status).label}`, icon: 'none' })
}

function addToCart(t: Tool) {
  // 已在领用篮：不重复添加，提示可直接去提交
  if (cartStore.hasItem(t.tool_id)) {
    uni.showToast({ title: '已在领用篮，可去提交', icon: 'none' })
    return
  }
  cartStore.addItem({
    tool_id: t.tool_id,
    tool_name: t.tool_name || t.tool_code,
    tool_code: t.tool_code,
    warehouse: t.warehouse || t.location_name || ''
  })
  uni.showToast({ title: '已加入领用篮', icon: 'success' })
}

function goCart() {
  uni.navigateTo({ url: '/pages/cart/ShoppingCart' })
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
  padding: 16rpx 24rpx 0;

  &__input {
    background: $tm-card-bg;
    border-radius: 999rpx;
    padding: 16rpx 28rpx;
    font-size: 26rpx;
    color: $tm-text;
  }

  &__ph {
    color: $tm-text-muted;
  }
}

.shelves {
  white-space: nowrap;
  padding: 16rpx 24rpx 4rpx;

  &__item {
    display: inline-block;
    padding: 10rpx 28rpx;
    margin-right: 16rpx;
    border-radius: 999rpx;
    background: $tm-card-bg;
    color: $tm-text-secondary;
    font-size: 24rpx;

    &--active {
      background: $tm-primary;
      color: #ffffff;
      font-weight: 600;
    }
  }
}

.list {
  flex: 1;
  padding: 16rpx 24rpx 120rpx;
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

  &__thumb {
    width: 88rpx;
    height: 88rpx;
    border-radius: $tm-radius-sm;
    margin-right: 20rpx;
    flex-shrink: 0;
    background: $tm-border-light;

    &--text {
      display: flex;
      align-items: center;
      justify-content: center;
      background: $tm-primary-bg;
      color: $tm-primary;
      font-size: 36rpx;
      font-weight: 600;
    }
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
  }

  &__code {
    margin-top: 6rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }

  &__loc {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: $tm-text-secondary;
  }

  &__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &__btn {
    margin-top: 12rpx;
    padding: 6rpx 24rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 24rpx;

    &--added {
      background: $tm-success;
      color: #ffffff;
    }
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

.cart-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: $tm-card-bg;
  border-top: 1rpx solid $tm-border;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);

  &__info {
    display: flex;
    align-items: center;
  }

  &__dot {
    min-width: 40rpx;
    height: 40rpx;
    line-height: 40rpx;
    text-align: center;
    border-radius: 999rpx;
    background: $tm-danger;
    color: #ffffff;
    font-size: 24rpx;
    margin-right: 16rpx;
  }

  &__text {
    font-size: 28rpx;
    color: $tm-text;
  }

  &__btn {
    padding: 14rpx 40rpx;
    border-radius: 999rpx;
    background: $tm-primary;
    color: #ffffff;
    font-size: 28rpx;
  }
}
</style>
