<template>
  <div class="inventory-create">
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
import { createInventoryCheck } from '@/api/material'
import { useAuthStore } from '@/store/auth'
import type { Warehouse, InventoryCheck } from '@/types'

// 态1：选仓库 + 创建盘库单；createInventoryCheck 返回预置 items（应盘清单）
const emit = defineEmits<{
  created: [check: InventoryCheck]
  cancel: []
}>()

const authStore = useAuthStore()
const warehouses = ref<Warehouse[]>([])
const selectedId = ref<number | null>(null)
const loading = ref(false)
const creating = ref(false)

const operator = computed<string>(() => authStore.user?.real_name || authStore.user?.username || '')

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
    warehouses.value = await getWarehouses()
  } catch (e) {
    showToast('加载仓库失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.inventory-create { padding-top: 12px; }
.center-tip { text-align: center; padding: 40px; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.action-bar { padding: 24px 16px; }
</style>
