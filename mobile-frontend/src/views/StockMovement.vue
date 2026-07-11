<template>
  <div class="page-container">
    <van-nav-bar title="出入库流水" left-text="返回" left-arrow fixed placeholder @click-left="$router.back()" />

    <StockFilter :current="currentFilter" @filter="onFilter" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="loading" class="center-tip"><van-loading size="20" /> 加载中...</div>
      <div v-else-if="filteredList.length === 0" class="empty-state"><p>暂无流水记录</p></div>
      <StockCell v-for="m in filteredList" :key="m.movement_id" :movement="m" />
    </van-pull-refresh>

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item v-for="t in MATERIAL_TABBAR" :key="t.to" :icon="t.icon" :to="t.to">{{ t.text }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import { getStockMovements } from '@/api/material'
import { MATERIAL_TABBAR, STOCK_FILTER_OPTIONS } from '@/constants/material'
import type { StockMovement } from '@/types'
import StockFilter from './stock/StockFilter.vue'
import StockCell from './stock/StockCell.vue'

// 出入库流水页：拉取后按 STOCK_FILTER_OPTIONS 客户端过滤（后端不支持 movement_type 过滤）
const list = ref<StockMovement[]>([])
const loading = ref(false)
const refreshing = ref(false)
const currentFilter = ref('all')
const active = ref(-1)

const filteredList = computed<StockMovement[]>(() => {
  const opt = STOCK_FILTER_OPTIONS.find((o) => o.key === currentFilter.value)
  if (!opt || opt.key === 'all') return list.value
  return list.value.filter((m) => opt.match(m))
})

async function load(): Promise<void> {
  loading.value = true
  try {
    // getStockMovements 在 material.ts 已 .then(r => r.data) 解包，直接返回 StockMovement[]
    const data = await getStockMovements({ limit: 200 })
    list.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    showToast(e?.response?.data?.message || '加载流水失败')
    list.value = []
  } finally {
    loading.value = false
  }
}

async function onRefresh(): Promise<void> {
  await load()
  refreshing.value = false
}

function onFilter(key: string): void {
  currentFilter.value = key
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }
.center-tip { text-align: center; padding: 40px; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
