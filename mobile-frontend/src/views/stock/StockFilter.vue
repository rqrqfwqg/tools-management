<template>
  <div class="stock-filter">
    <van-tabs v-model="activeLocal" @click-tab="onClickTab">
      <van-tab v-for="opt in options" :key="opt.key" :title="opt.label" />
    </van-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { STOCK_FILTER_OPTIONS } from '@/constants/material'

// 出入库筛选栏：仅切换当前筛选 key，实际过滤在 StockMovement 中按 STOCK_FILTER_OPTIONS 执行
const props = defineProps<{
  current: string
}>()

const emit = defineEmits<{
  filter: [key: string]
}>()

const options = STOCK_FILTER_OPTIONS
const activeLocal = ref(0)

onMounted(() => {
  const idx = options.findIndex((o) => o.key === props.current)
  if (idx >= 0) activeLocal.value = idx
})

function onClickTab(tab: { index?: number }): void {
  const idx = tab.index ?? 0
  const opt = options[idx]
  if (opt) emit('filter', opt.key)
}
</script>

<style scoped>
.stock-filter { background: #fff; position: sticky; top: 46px; z-index: 10; }
</style>
