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
import { getSpareItems, getConsumables, mapConsumable } from '@/api/material'
import { toArray } from '@/utils/status'
import { useCartStore } from '@/store/cart'
import { useMaterialCartStore } from '@/store/materialCart'
import { showToast } from '@/utils/feedback'

const { scan, manualFallback } = useScanner({ title: '扫码选用' })
const cartStore = useCartStore()
const materialCart = useMaterialCartStore()
const scanning = ref(false)

/** 识别编码：工具码 → 加入工具领用篮跳工具页；物料码 → 加入物料购物车跳物料领用页 */
async function handleCode(raw: string): Promise<void> {
  const code = (raw || '').trim()
  if (!code) return

  // 1) 工具码
  try {
    const tool: any = await getToolByCode(code)
    if (tool && tool.tool_id != null) {
      if (tool.status !== 'available') {
        showToast(`「${tool.tool_name || tool.tool_code}」当前不可领用`, 'none')
        return
      }
      if (!cartStore.hasItem(tool.tool_id)) {
        cartStore.addItem({
          tool_id: tool.tool_id,
          tool_name: tool.tool_name || tool.tool_code,
          tool_code: tool.tool_code,
          warehouse: tool.warehouse || tool.location_name || ''
        })
      }
      showToast('已扫码加入工具领用篮', 'success')
      uni.switchTab({ url: '/pages/tools/ToolManagement' })
      return
    }
  } catch {
    // 非工具码，继续按物料处理
  }

  // 2) 物料码：匹配备件单品/消耗品 → 加入物料购物车 → 跳物料领用页
  const [sp, co] = await Promise.all([
    getSpareItems().catch(() => []),
    getConsumables().catch(() => [])
  ])
  const spares: any[] = toArray(sp)
  const cons: any[] = toArray(co)
  const c = code.toUpperCase()

  // 备件单品（一对一码，如 SI-1A2B3C4D）：直接借用该件
  const spare = spares.find((s) => (s.item_code || '').toUpperCase() === c)
  if (spare) {
    if (spare.status && spare.status !== 'in_stock') {
      showToast(`「${spare.spare_name || spare.item_code}」不在库，无法借用`, 'none')
      return
    }
    materialCart.addItem(
      {
        key: `spare_item:${spare.item_id}`,
        type: 'spare_item',
        id: spare.item_id,
        code: spare.item_code || '',
        name: spare.spare_name || '',
        unit: spare.unit || '件',
        stock: 1
      },
      1
    )
    showToast(`已加入物料购物车「${spare.spare_name}」`, 'success')
    uni.navigateTo({ url: '/pages/material/MaterialDispense' })
    return
  }

  const con = cons.find((x) => (x.consumable_code || '').toUpperCase() === c)
  if (con) {
    const mapped = mapConsumable(con)
    materialCart.addItem(
      {
        key: `cons:${con.consumable_id}`,
        type: 'cons',
        id: con.consumable_id,
        code: con.consumable_code || '',
        name: con.consumable_name || '',
        unit: con.unit || '',
        stock: Number(con.stock_qty ?? 0),
        outboundType: (mapped.outbound_type || 'direct') as 'workorder' | 'direct'
      },
      1
    )
    showToast(`已加入物料购物车「${con.consumable_name}」`, 'success')
    uni.navigateTo({ url: '/pages/material/MaterialDispense' })
    return
  }

  showToast('未识别到对应的工具或物料', 'none')
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
