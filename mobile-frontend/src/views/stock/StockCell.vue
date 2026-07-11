<template>
  <div class="stock-cell">
    <div class="stock-cell-title">
      <van-tag :type="movementTypeTag" size="medium">{{ movementTypeText }}</van-tag>
      <span class="stock-cell-name">{{ movement.item_name || movement.item_code || '-' }}</span>
    </div>
    <div class="stock-cell-meta">
      <span>{{ itemTypeText }}</span>
      <span>·</span>
      <span>数量 {{ movement.qty }}</span>
      <span v-if="movement.operator_name">· {{ movement.operator_name }}</span>
    </div>
    <div class="stock-cell-foot">
      <span class="stock-cell-code">{{ movement.item_code || '-' }}</span>
      <span class="stock-cell-time">{{ formatTime(movement.created_at) }}</span>
    </div>
    <div v-if="movement.remark" class="stock-cell-remark">备注：{{ movement.remark }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TagType } from 'vant'
import { MOVEMENT_TYPE_TEXT, ITEM_TYPE_TEXT } from '@/constants/material'
import type { StockMovement } from '@/types'

// 流水项 cell：中文映射统一从 constants/material.ts 取
const props = defineProps<{
  movement: StockMovement
}>()

const movementTypeText = computed<string>(
  () => MOVEMENT_TYPE_TEXT[props.movement.movement_type] || props.movement.movement_type
)
const itemTypeText = computed<string>(
  () => ITEM_TYPE_TEXT[props.movement.item_type] || props.movement.item_type
)

const movementTypeTag = computed<TagType>(() => {
  switch (props.movement.movement_type) {
    case 'in':
      return 'success'
    case 'out':
      return 'danger'
    case 'adjust':
      return props.movement.qty > 0 ? 'primary' : 'warning'
    default:
      return 'default'
  }
})

function formatTime(ts?: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.stock-cell {
  background: #fff; margin: 0 12px 8px; border-radius: 8px; padding: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.stock-cell-title { display: flex; align-items: center; gap: 8px; }
.stock-cell-name { font-size: 15px; font-weight: 600; color: #323233; }
.stock-cell-meta { font-size: 12px; color: #969799; margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
.stock-cell-foot { font-size: 12px; color: #c8c9cc; margin-top: 6px; display: flex; justify-content: space-between; }
.stock-cell-remark { font-size: 12px; color: #969799; margin-top: 6px; }
</style>
