<template>
  <div class="material-card" @click="$emit('click', current)">
    <div class="material-card-thumb">
      <van-image
        v-if="current?.image_url"
        :src="current.image_url"
        fit="cover"
        width="64"
        height="64"
        radius="6"
      />
      <van-icon v-else name="photo-o" size="36" color="#c8c9cc" />
    </div>
    <div class="material-card-info">
      <div class="material-card-title">
        {{ current?.spare_name || current?.consumable_name || current?.name || '未命名' }}
        <van-tag v-if="lowStock" type="warning" size="medium" class="status-in-line">库存预警</van-tag>
      </div>
      <div class="material-card-code">{{ current?.spare_code || current?.consumable_code || current?.code || '-' }}</div>
      <div class="material-card-desc">{{ stockText }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 通用物料卡片：备件 / 消耗品复用，含低库存预警标签。
// 字段读取采用与 ScanResultPopup 一致的宽松方式（any），避免散落的字段适配逻辑。
const props = defineProps<{
  spare?: any | null
  consumable?: any | null
}>()

defineEmits<{
  click: [item: any]
}>()

const current = computed<any>(() => props.spare || props.consumable || null)

const stockText = computed<string>(() => {
  const q = current.value?.stock_qty
  if (q == null) return '库存未知'
  const unit = current.value?.unit
  return `${q} ${unit || ''}`.trim()
})

// 低库存判定：
// - 备件(spare)：优先使用后端衍生字段 is_low_stock（按型号聚合判定），避免旧数据因无 warning_qty 而恒不触发
// - 消耗品(consumable)：回退原逻辑 warning_qty 非空 且 库存 <= 预警值
const lowStock = computed<boolean>(() => {
  const c = current.value
  if (!c) return false
  if (props.spare) {
    if (c.is_low_stock != null) return !!c.is_low_stock
    // 兜底：直接按该件预警值判断
    return c.warning_qty != null && c.stock_qty != null && c.stock_qty <= c.warning_qty
  }
  return c.warning_qty != null && c.stock_qty != null && c.stock_qty <= c.warning_qty
})
</script>

<style scoped>
.material-card {
  display: flex;
  background: #fff;
  border-radius: 8px;
  margin: 0 12px 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  min-height: 88px;
  cursor: pointer;
}
.material-card-thumb {
  width: 64px; height: 64px; border-radius: 6px; overflow: hidden;
  background: #f7f8fa; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin: 12px;
}
.material-card-thumb :deep(img) { width: 100%; height: 100%; object-fit: cover; }
.material-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; padding: 10px 10px 10px 0; }
.material-card-title { font-size: 15px; font-weight: 600; color: #323233; line-height: 1.3; display: flex; align-items: center; gap: 6px; }
.material-card-code { font-size: 12px; color: #969799; margin-top: 2px; }
.material-card-desc { font-size: 12px; color: #969799; margin-top: 2px; }
</style>
