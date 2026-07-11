<template>
  <div class="page-container">
    <van-nav-bar :title="title" left-text="返回" left-arrow fixed placeholder @click-left="onBack" />

    <InventoryCreate v-if="state === 'create'" @created="onCreated" @cancel="goCenter" />
    <InventoryScan
      v-else-if="state === 'scan'"
      :check="check"
      @complete="onScanComplete"
      @cancel="goCenter"
    />
    <InventoryResult v-else-if="state === 'result'" :check="check" @back="goCenter" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import InventoryCreate from './inventory/InventoryCreate.vue'
import InventoryScan from './inventory/InventoryScan.vue'
import InventoryResult from './inventory/InventoryResult.vue'
import type { InventoryCheck } from '@/types'

// 盘点三态容器：create -> scan -> result，持有当前盘库单 check
const router = useRouter()
const state = ref<'create' | 'scan' | 'result'>('create')
const check = ref<InventoryCheck | null>(null)

const title = computed<string>(() => {
  if (state.value === 'create') return '新建盘库单'
  if (state.value === 'scan') return '盘点录入'
  return '盘点结果'
})

function onCreated(c: InventoryCheck): void {
  check.value = c
  state.value = 'scan'
}

function onScanComplete(c: InventoryCheck): void {
  check.value = c
  state.value = 'result'
}

function goCenter(): void {
  router.replace('/material-center')
}

function onBack(): void {
  // 任意中间态返回均回到物料中心，避免半成品数据残留
  goCenter()
}
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }
</style>
