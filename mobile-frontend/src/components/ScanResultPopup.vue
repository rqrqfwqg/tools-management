<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '70%' }"
    closeable
    @update:show="$emit('update:show', $event)"
    @closed="$emit('close')"
  >
    <div class="result-panel" v-if="current">
      <!-- 图片 -->
      <div class="result-image-section">
        <van-image
          v-if="current.image_url"
          :src="current.image_url"
          fit="cover"
          width="100%"
          height="180"
          radius="8"
        />
        <div v-else class="result-image-placeholder">
          <van-icon name="photo-o" size="48" color="#c8c9cc" />
          <p>暂无图片</p>
        </div>
      </div>

      <!-- 信息 -->
      <div class="result-info">
        <div class="result-title">
          <span class="result-name">{{ current.name }}</span>
          <van-tag :type="statusTagType" size="medium">{{ statusLabel }}</van-tag>
        </div>

        <van-cell-group inset>
          <van-cell :title="codeLabel" :value="current.code" />
          <van-cell title="分类" :value="current.category_name || '-'" />
          <van-cell title="仓库" :value="current.warehouse_name || current.warehouse || '未分配'" />
          <van-cell title="货架" :value="current.shelf_name || '未分配'" />
          <van-cell title="货位" :value="current.location_name || '未分配'" />
          <van-cell v-if="kind === 'consumable'" title="当前库存" :value="`${current.stock_qty} ${current.unit || ''}`" />
          <van-cell v-if="kind === 'spare'" title="借出次数" :value="String(current.borrow_count || 0)" />
        </van-cell-group>
      </div>

      <!-- 消耗品：数量输入 -->
      <div v-if="kind === 'consumable'" class="qty-block">
        <van-field
          v-model="qty"
          type="digit"
          label="领用数量"
          :border="false"
          placeholder="请输入数量"
        />
      </div>

      <!-- 操作按钮 -->
      <div class="result-actions">
        <van-button
          v-if="kind === 'tool' && current.status === 'available'"
          type="primary" block round :loading="acting"
          @click="handleBorrowTool"
        >立即领用</van-button>
        <van-button
          v-else-if="kind === 'tool' && current.status === 'borrowed'"
          type="warning" block round disabled
        >已被借出</van-button>
        <van-button
          v-else-if="kind === 'tool' && current.status === 'reserved'"
          type="default" block round disabled
        >已被预留</van-button>
        <van-button
          v-else-if="kind === 'tool'"
          type="default" block round disabled
        >{{ statusLabel }}</van-button>

        <van-button
          v-else-if="kind === 'spare' && current.status === 'available'"
          type="primary" block round :loading="acting"
          @click="handleBorrowSpare"
        >扫码领用（生成工单）</van-button>
        <van-button
          v-else-if="kind === 'spare'"
          type="default" block round disabled
        >{{ statusLabel }}</van-button>

        <van-button
          v-else-if="kind === 'consumable'"
          type="primary" block round :loading="acting"
          @click="handleTakeConsumable"
        >确认直领</van-button>
      </div>
    </div>

    <!-- 无数据 -->
    <div v-else class="result-empty">
      <van-loading />
      <p>加载中...</p>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { borrowToolByCode } from '@/api'
import { borrowSpareByCode, takeConsumableByCode } from '@/api/material'
import { showSuccessToast, showFailToast } from 'vant'
import { useCartStore } from '@/store/cart'
import { useScanHistoryStore } from '@/store/scanHistory'
import type { TagType } from 'vant'
import type { Tool } from '@/types'

const props = defineProps<{
  show: boolean
  tool?: Tool | null
  spare?: any | null
  consumable?: any | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

const cartStore = useCartStore()
const scanHistoryStore = useScanHistoryStore()
const acting = ref(false)
const qty = ref('1')

const kind = computed<'tool' | 'spare' | 'consumable' | null>(() => {
  if (props.spare) return 'spare'
  if (props.consumable) return 'consumable'
  if (props.tool) return 'tool'
  return null
})

const current = computed<any>(() => props.spare || props.consumable || props.tool || null)

const codeLabel = computed(() => {
  if (kind.value === 'spare') return '备件编码'
  if (kind.value === 'consumable') return '消耗品编码'
  return '工具编码'
})

const statusLabel = computed(() => {
  const c = current.value
  if (!c) return ''
  if (kind.value === 'consumable') {
    return (c.warning_qty != null && c.stock_qty <= c.warning_qty) ? '库存预警' : '正常'
  }
  const map: Record<string, string> = {
    available: '可用', borrowed: '已借出', reserved: '已预留',
    maintenance: '维修中', scrapped: '已报废'
  }
  return map[c.status] || c.status
})

const statusTagType = computed<TagType>(() => {
  const c = current.value
  if (!c) return 'default'
  if (kind.value === 'consumable') {
    return (c.warning_qty != null && c.stock_qty <= c.warning_qty) ? 'warning' : 'success'
  }
  const map: Record<string, TagType> = {
    available: 'success', borrowed: 'danger', reserved: 'warning',
    maintenance: 'warning', scrapped: 'default'
  }
  return map[c.status] || 'default'
})

/** 工具领用 */
async function handleBorrowTool(): Promise<void> {
  if (!props.tool) return
  acting.value = true
  try {
    const result = await borrowToolByCode(props.tool.tool_code, { scene: '扫码领用' })
    cartStore.addItem({
      tool_id: props.tool.tool_id,
      tool_name: props.tool.tool_name,
      tool_code: props.tool.tool_code,
      warehouse: props.tool.warehouse || '',
      image_url: props.tool.image_url || ''
    })
    scanHistoryStore.addRecord({
      tool_id: props.tool.tool_id,
      tool_code: props.tool.tool_code,
      tool_name: props.tool.tool_name,
      status: 'reserved'
    })
    showSuccessToast(`领用成功! 订单号: ${result.order_no}`)
    emit('update:show', false)
    emit('close')
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '领用失败')
  } finally {
    acting.value = false
  }
}

/** 备件领用（生成工单） */
async function handleBorrowSpare(): Promise<void> {
  if (!props.spare) return
  acting.value = true
  try {
    const result = await borrowSpareByCode(props.spare.spare_code, { scene: '移动端扫码领用' })
    showSuccessToast(`领用成功！工单号：${result.order_no}`)
    emit('update:show', false)
    emit('close')
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '领用失败')
  } finally {
    acting.value = false
  }
}

/** 消耗品直领 */
async function handleTakeConsumable(): Promise<void> {
  if (!props.consumable) return
  const n = parseInt(qty.value)
  if (!n || n <= 0) { showFailToast('请输入有效数量'); return }
  if (n > props.consumable.stock_qty) { showFailToast(`超出库存（${props.consumable.stock_qty}）`); return }
  acting.value = true
  try {
    await takeConsumableByCode(props.consumable.consumable_code, n)
    showSuccessToast('领用成功')
    emit('update:show', false)
    emit('close')
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '领用失败')
  } finally {
    acting.value = false
  }
}
</script>

<style scoped>
.result-panel { padding: 16px 16px 32px; min-height: 50vh; }
.result-image-section { margin-bottom: 16px; }
.result-image-placeholder {
  width: 100%; height: 180px; border-radius: 8px; background: #f7f8fa;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: #c8c9cc; font-size: 14px;
}
.result-info { margin-bottom: 20px; }
.result-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 0 8px; }
.result-name { font-size: 18px; font-weight: 600; color: #323233; }
.qty-block { padding: 0 16px 8px; }
.result-actions { padding: 0 8px; }
.result-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 12px; color: #969799;
}
</style>
