<template>
  <view class="page">
    <view class="brand">
      <view class="brand__icon">▣</view>
      <view class="brand__title">{{ scanning ? '正在识别…' : '扫码选用' }}</view>
      <view class="brand__sub">对准物品条码/二维码，自动识别工具或物料</view>
    </view>

    <view class="scan-zone" @tap="doScan">
      <view class="scan-zone__frame" />
      <view class="scan-zone__hint">点击此处重新扫码</view>
    </view>

    <button class="manual-btn" :disabled="scanning" @tap="doManual">手动输入编码</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScanner } from '@/composables/useScanner'
import { getToolByCode } from '@/api'
import { useCartStore } from '@/store/cart'
import { showToast } from '@/utils/feedback'

const { scan, manualFallback } = useScanner({ title: '扫码选用' })
const cartStore = useCartStore()
const scanning = ref(false)

/** 识别编码：工具码 → 加入领用篮跳购物车；物料码 → 跳物料领用页自动选中 */
async function handleCode(raw: string): Promise<void> {
  const code = (raw || '').trim()
  if (!code) return

  // 1) 先尝试工具码
  try {
    const tool: any = await getToolByCode(code)
    if (tool && tool.tool_id != null) {
      if (tool.status !== 'available') {
        showToast(`「${tool.tool_name || tool.tool_code}」当前不可领用`, 'none')
        return
      }
      if (cartStore.hasItem(tool.tool_id)) {
        showToast('已在领用篮，可去提交', 'none')
        uni.navigateTo({ url: '/pages/cart/ShoppingCart' })
        return
      }
      cartStore.addItem({
        tool_id: tool.tool_id,
        tool_name: tool.tool_name || tool.tool_code,
        tool_code: tool.tool_code,
        warehouse: tool.warehouse || tool.location_name || ''
      })
      showToast('已扫码加入领用篮', 'success')
      uni.navigateTo({ url: '/pages/cart/ShoppingCart' })
      return
    }
  } catch {
    // 非工具码，继续按物料处理
  }

  // 2) 物料码 → 物料领用页自动选中（页面按编码匹配备件/消耗品）
  uni.redirectTo({ url: `/pages/material/MaterialDispense?code=${encodeURIComponent(code)}` })
}

async function doScan(): Promise<void> {
  if (scanning.value) return
  scanning.value = true
  try {
    const res = await scan()
    if (res) {
      await handleCode(res.code)
    }
  } finally {
    scanning.value = false
  }
}

async function doManual(): Promise<void> {
  if (scanning.value) return
  scanning.value = true
  try {
    const res = await manualFallback()
    if (res) {
      await handleCode(res.code)
    }
  } finally {
    scanning.value = false
  }
}

// 进入页面自动开始扫码（首次）
let autoStarted = false
onShow(() => {
  if (!autoStarted) {
    autoStarted = true
    doScan()
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $tm-bg;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 48rpx 120rpx;
  box-sizing: border-box;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;

  &__icon {
    width: 120rpx;
    height: 120rpx;
    border-radius: 28rpx;
    background: linear-gradient(135deg, $tm-primary, $tm-primary-dark);
    color: #fff;
    font-size: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12rpx 32rpx rgba(7, 193, 96, 0.25);
  }

  &__title {
    margin-top: 28rpx;
    font-size: 36rpx;
    font-weight: 600;
    color: $tm-text;
  }

  &__sub {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: $tm-text-muted;
  }
}

.scan-zone {
  width: 100%;
  margin-top: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  &__frame {
    width: 420rpx;
    height: 420rpx;
    border: 6rpx solid $tm-primary;
    border-radius: 24rpx;
    box-shadow: 0 0 0 1000rpx rgba(0, 0, 0, 0.06);
  }

  &__hint {
    margin-top: 28rpx;
    font-size: 26rpx;
    color: $tm-text-secondary;
  }
}

.manual-btn {
  margin-top: 80rpx;
  width: 100%;
  height: 88rpx;
  border-radius: 44rpx;
  background: $tm-card-bg;
  color: $tm-primary;
  font-size: 30rpx;
  font-weight: 600;
  border: 1rpx solid $tm-border;
  line-height: 88rpx;
  padding: 0;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }
}
</style>
