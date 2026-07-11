<template>
  <div class="inventory-scan">
    <!-- 顶部进度 + 完成按钮（置顶吸附） -->
    <div class="scan-header">
      <div class="scan-progress-text">已录入 {{ enteredCount }} / 应盘 {{ totalCount }}</div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <van-button type="primary" block round :loading="finishing" @click="finish">完成盘库</van-button>
    </div>

    <van-search v-model="keyword" placeholder="搜索编码/名称" shape="round" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="items.length === 0" class="empty-state"><p>暂无应盘明细</p></div>
      <div v-for="item in filteredItems" :key="item.item_code" class="scan-item">
        <div class="scan-item-head">
          <span class="scan-item-name">{{ item.item_name }}</span>
          <van-tag :type="item.item_type === 'spare' ? 'primary' : 'success'">
            {{ item.item_type === 'spare' ? '备件' : '消耗品' }}
          </van-tag>
          <van-tag v-if="item.entered" type="success">已录入</van-tag>
        </div>
        <div class="scan-item-code">{{ item.item_code }} · 系统账 {{ item.system_qty }}</div>
        <div class="scan-item-edit">
          <template v-if="item.item_type === 'spare'">
            <van-checkbox v-model="item.checked" shape="square" @change="onSpareChange(item)">
              在位（勾选=在库，取消=缺失）
            </van-checkbox>
          </template>
          <template v-else>
            <van-field
              v-model="item.actualInput"
              type="digit"
              label="实盘数量"
              :border="false"
              placeholder="请输入实数"
              @blur="onConsumableBlur(item)"
            />
          </template>
        </div>
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { showSuccessToast, showFailToast } from 'vant'
import { scanInventoryCheck } from '@/api/material'
import type { InventoryCheck, InventoryCheckItem } from '@/types'

// 态2：以 items 为应盘清单逐项录入 actual_qty；备件用 checkbox(在位1/缺失0)，消耗品用 digit 实数
interface ScanItem extends InventoryCheckItem {
  entered: boolean
  actualInput: string
  checked: boolean
}

const props = defineProps<{
  check: InventoryCheck
}>()

const emit = defineEmits<{
  complete: [check: InventoryCheck]
  cancel: []
}>()

const items = ref<ScanItem[]>([])
const keyword = ref('')
const refreshing = ref(false)
const finishing = ref(false)

const totalCount = computed(() => items.value.length)
const enteredCount = computed(() => items.value.filter((i) => i.entered).length)
const progressPercent = computed(() =>
  totalCount.value ? Math.round((enteredCount.value / totalCount.value) * 100) : 0
)

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter(
    (i) => i.item_name?.toLowerCase().includes(kw) || i.item_code?.toLowerCase().includes(kw)
  )
})

onMounted(() => {
  items.value = (props.check.items || []).map((i: InventoryCheckItem) => ({
    ...i,
    entered: false,
    actualInput: String(i.actual_qty ?? ''),
    checked: i.actual_qty === 1
  }))
})

function currentActual(item: ScanItem): number {
  if (item.item_type === 'spare') return item.checked ? 1 : 0
  const n = parseInt(item.actualInput || '0', 10)
  return isNaN(n) ? 0 : n
}

async function submitItem(item: ScanItem): Promise<void> {
  const actual = currentActual(item)
  try {
    const res = await scanInventoryCheck(props.check.check_id, item.item_code, actual)
    item.actual_qty = actual
    if (res?.item?.diff != null) item.diff = res.item.diff
    item.entered = true
    showSuccessToast(`已录入：${item.item_name}`)
  } catch (err: any) {
    showFailToast(err?.response?.data?.message || err?.message || '录入失败')
  }
}

function onSpareChange(item: ScanItem): void {
  submitItem(item)
}

function onConsumableBlur(item: ScanItem): void {
  submitItem(item)
}

function finish(): void {
  emit('complete', props.check)
}

function onRefresh(): void {
  refreshing.value = false
}
</script>

<style scoped>
.inventory-scan { padding-bottom: 24px; }
.scan-header {
  position: sticky; top: 46px; z-index: 10; background: #f7f8fa;
  padding: 10px 16px 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.scan-progress-text { font-size: 14px; color: #323233; margin-bottom: 6px; font-weight: 500; }
.progress-track { height: 6px; background: #ebedf0; border-radius: 3px; overflow: hidden; margin-bottom: 12px; }
.progress-fill { height: 100%; background: #07c160; transition: width 0.3s; }
.scan-item { background: #fff; margin: 0 12px 8px; border-radius: 8px; padding: 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); }
.scan-item-head { display: flex; align-items: center; gap: 8px; }
.scan-item-name { font-size: 15px; font-weight: 600; color: #323233; }
.scan-item-code { font-size: 12px; color: #969799; margin-top: 4px; }
.scan-item-edit { margin-top: 8px; }
.empty-state { text-align: center; padding: 40px; color: #999; }
</style>
