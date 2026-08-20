<template>
  <div class="inventory-result">
    <div v-if="loading" class="center-tip"><van-loading size="20" /> 正在完成盘库...</div>
    <template v-else>
      <van-cell-group inset title="盘点差异汇总">
        <van-cell title="盘库单号" :value="check.check_no" />
        <van-cell title="仓库" :value="check.warehouse_name || '-'" />
        <van-cell title="应盘项" :value="String(items.length)" />
        <van-cell title="差异项" :value="String(diffCount)" />
      </van-cell-group>

      <div class="result-list">
        <div
          v-for="item in items"
          :key="item.item_code"
          class="result-item"
          :class="{ 'diff-highlight': item.diff !== 0 }"
        >
          <div class="result-item-head">
            <span class="result-item-name">{{ item.item_name }}</span>
            <van-tag :type="item.item_type === 'spare' ? 'primary' : item.item_type === 'consumable' ? 'warning' : 'success'">
              {{ item.item_type === 'spare' ? '备件' : item.item_type === 'consumable' ? '消耗品' : '工具' }}
            </van-tag>
          </div>
          <div class="result-item-code">{{ item.item_code }}</div>
          <div class="result-item-nums">
            <span>系统账 {{ item.system_qty }}</span>
            <span>实盘 {{ isCounted(item) ? item.actual_qty : '未盘' }}</span>
            <span :class="isCounted(item) ? (item.diff > 0 ? 'up' : item.diff < 0 ? 'down' : '') : 'unchecked'">
              {{ isCounted(item) ? '差异 ' + (item.diff > 0 ? '+' : '') + item.diff : '未盘' }}
            </span>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <van-button type="primary" block round @click="goBack">返回物料中心</van-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showFailToast } from 'vant'
import { completeInventoryCheck } from '@/api/material'
import type { InventoryCheck, InventoryCheckItem } from '@/types'

// 态3：调用 completeInventoryCheck 落账，渲染 items，diff≠0 高亮
const props = defineProps<{
  check: InventoryCheck
}>()

const emit = defineEmits<{
  back: []
}>()

const loading = ref(true)
const items = ref<InventoryCheckItem[]>([])

/** 是否已录入：counted 标记为真，或后端返回了实际数量（未盘项不显示负差异、不计入差异汇总） */
function isCounted(item: InventoryCheckItem): boolean {
  return item.counted === true || item.actual_qty != null
}

const diffCount = computed(() => items.value.filter((i) => isCounted(i) && i.diff !== 0).length)

async function doComplete(): Promise<void> {
  loading.value = true
  try {
    const res = await completeInventoryCheck(props.check.check_id)
    items.value = res?.check?.items || props.check.items || []
  } catch (err: any) {
    if (err?.response?.status === 403) {
      showFailToast('需物料管理员权限')
    } else {
      showFailToast(err?.response?.data?.message || err?.message || '完成盘库失败')
    }
    // 即使失败也展示已有 items，避免白屏
    items.value = props.check.items || []
  } finally {
    loading.value = false
  }
}

function goBack(): void {
  emit('back')
}

onMounted(() => {
  doComplete()
})
</script>

<style scoped>
.inventory-result { padding-bottom: 24px; }
.center-tip { text-align: center; padding: 60px 0; color: #969799; display: flex; align-items: center; justify-content: center; gap: 8px; }
.result-list { padding: 12px 0; }
.result-item { background: #fff; margin: 0 12px 8px; border-radius: 8px; padding: 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); border-left: 3px solid transparent; }
.result-item.diff-highlight { border-left-color: #ee0a24; background: #fff7f7; }
.result-item-head { display: flex; align-items: center; gap: 8px; }
.result-item-name { font-size: 15px; font-weight: 600; color: #323233; }
.result-item-code { font-size: 12px; color: #969799; margin-top: 4px; }
.result-item-nums { font-size: 12px; color: #969799; margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap; }
.result-item-nums .up { color: #07c160; }
.result-item-nums .down { color: #ee0a24; }
.result-item-nums .unchecked { color: #c8c9cc; }
.action-bar { padding: 16px; }
</style>
