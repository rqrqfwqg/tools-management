<template>
  <div class="inventory-create">
    <!-- P0-3：存在 pending 单时展示"继续未完成盘库单"入口 -->
    <template v-if="pendingChecks.length > 0">
      <van-cell-group inset title="继续未完成盘库单">
        <van-cell
          v-for="c in pendingChecks"
          :key="c.check_id"
          :title="c.check_no"
          :label="`${c.warehouse_name || ''} · 进度 ${progressOf(c)} · ${formatTime(c.started_at)}`"
          is-link
          @click="emit('resume', c)"
        />
      </van-cell-group>
      <div class="pending-divider"><span>或新建盘库单</span></div>
    </template>

    <van-cell-group inset title="选择仓库">
      <van-cell
        v-for="w in warehouses"
        :key="w.warehouse_id"
        :title="w.warehouse_name"
        :label="w.warehouse_code"
        is-link
        @click="selectWarehouse(w)"
      >
        <template #right-icon>
          <van-icon v-if="selectedId === w.warehouse_id" name="success" color="#07c160" />
        </template>
      </van-cell>
    </van-cell-group>

    <div v-if="loading" class="center-tip"><van-loading size="20" /> 加载中...</div>

    <div class="action-bar">
      <van-button type="primary" block round :loading="creating" :disabled="!selectedId" @click="create">
        开始盘点
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showToast, showFailToast } from 'vant'
import { getWarehouses } from '@/api'
import { createInventoryCheck, getInventoryChecks } from '@/api/material'
import { isItemEntered } from '@/composables/useInventoryEntered'
import { useAuthStore } from '@/store/auth'
import type { Warehouse, InventoryCheck } from '@/types'

// 态1：选仓库 + 创建盘库单；createInventoryCheck 返回预置 items（应盘清单）
// P0-3：首屏展示 pending 盘库单入口（单号/仓库/进度 X/Y/开始时间），点击 resume 恢复
const emit = defineEmits<{
  created: [check: InventoryCheck]
  resume: [check: InventoryCheck]
  cancel: []
}>()

const authStore = useAuthStore()
const warehouses = ref<Warehouse[]>([])
const selectedId = ref<number | null>(null)
const loading = ref(false)
const creating = ref(false)

const operator = computed<string>(() => authStore.user?.real_name || authStore.user?.username || '')

const pendingChecks = ref<InventoryCheck[]>([])

// 进度 X/Y：已录入数 = actual_qty!==system_qty 或本地集合有录入痕迹（决策 #3 语义）
function progressOf(check: InventoryCheck): string {
  const items = check.items || []
  if (items.length === 0) return '0/0'
  const done = items.filter((it) => isItemEntered(check.check_id, it)).length
  return `${done}/${items.length}`
}

function formatTime(t?: string): string {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 16)
}

function selectWarehouse(w: Warehouse): void {
  selectedId.value = w.warehouse_id
}

async function create(): Promise<void> {
  if (!selectedId.value) return
  creating.value = true
  try {
    const check = await createInventoryCheck({
      warehouse_id: selectedId.value,
      operator: operator.value || undefined
    })
    emit('created', check as InventoryCheck)
  } catch (err: any) {
    if (err?.response?.status === 403) {
      showFailToast('需物料管理员权限')
    } else {
      showFailToast(err?.response?.data?.message || err?.message || '创建盘库单失败')
    }
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [whs, checks] = await Promise.all([getWarehouses(), getInventoryChecks()])
    warehouses.value = whs
    pendingChecks.value = (checks || []).filter((c) => c.status === 'pending')
  } catch (e) {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.inventory-create { padding-top: 12px; }
.pending-divider { text-align: center; color: #969799; font-size: 13px; padding: 12px 0 4px; }
.center-tip { text-align: center; padding: 40px; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.action-bar { padding: 24px 16px; }
</style>
