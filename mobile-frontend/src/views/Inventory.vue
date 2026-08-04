<template>
  <div class="page-container">
    <van-nav-bar :title="title" left-text="返回" left-arrow fixed placeholder @click-left="onBack" />

    <InventoryCreate v-if="state === 'create'" @created="onCreated" @resume="onResume" @cancel="goCenter" />
    <InventoryScan
      v-else-if="state === 'scan'"
      :check="check"
      @complete="onScanComplete"
      @cancel="goCenter"
      @pause="onPause"
      @go-shelf="onGoShelf"
    />
    <InventoryResult v-else-if="state === 'result'" :check="check" @back="goCenter" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InventoryCreate from './inventory/InventoryCreate.vue'
import InventoryScan from './inventory/InventoryScan.vue'
import InventoryResult from './inventory/InventoryResult.vue'
import { getInventoryCheckById } from '@/api/material'
import type { InventoryCheck } from '@/types'

// 盘点三态容器：create -> scan -> result，持有当前盘库单 check
const route = useRoute()
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

function onResume(c: InventoryCheck): void {
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
  // 任意中间态返回均回到物料中心（scan 态=暂停语义：DB 保留 pending 单，不调后端）
  goCenter()
}

// 暂停并退出：保留 pending 单，返回物料中心（决策 #5，零后端改动）
function onPause(): void {
  goCenter()
}

// 货架导航：跳转独立货架导航盘点页（T05）
function onGoShelf(): void {
  if (check.value) {
    router.push({ path: '/inventory/shelf', query: { check_id: String(check.value.check_id) } })
  }
}

// 首屏恢复：货架导航返回 /inventory?resume_check_id=xx 时自动恢复 scan 态
async function onMountedResume(): Promise<void> {
  const resumeId = route.query.resume_check_id
  if (!resumeId) return
  try {
    const c = await getInventoryCheckById(Number(resumeId))
    check.value = c
    state.value = 'scan'
  } catch (e) {
    console.error('恢复盘库单失败', e)
  }
}

onMounted(onMountedResume)
</script>

<style scoped>
.page-container { min-height: 100vh; background: #f7f8fa; padding-bottom: 60px; }
</style>
