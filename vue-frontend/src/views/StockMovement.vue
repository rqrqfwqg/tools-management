<template>
  <div>
    <h2>出入库流水</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-select v-model="typeFilter" placeholder="全部类型" clearable style="width:160px" @change="reload">
        <el-option label="工具" value="tool" />
        <el-option label="备件" value="spare" />
        <el-option label="消耗品" value="consumable" />
      </el-select>
      <el-select v-model="movementFilter" placeholder="全部动作" clearable style="width:160px" @change="reload">
        <el-option label="入库" value="in" />
        <el-option label="出库" value="out" />
        <el-option label="调整" value="adjust" />
        <el-option label="借出" value="borrow" />
        <el-option label="归还" value="return" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索编码/名称/操作人" clearable prefix-icon="Search" style="width:220px" @input="reload" />
    </div>
    <el-table :data="pagedList" border style="margin-top:0">
      <el-table-column prop="movement_id" label="ID" width="60" />
      <el-table-column label="类型" width="90">
        <template #default="{row}"><el-tag :type="itemTypeTag(row.item_type)">{{ itemTypeText(row.item_type) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="动作" width="90">
        <template #default="{row}"><el-tag :type="movementTag(row.movement_type)">{{ movementText(row.movement_type) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="item_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="item_name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column label="数量" width="80">
        <template #default="{row}">
          <span :style="{ color: row.qty < 0 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">{{ row.qty }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="operator_name" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column prop="created_at" label="时间" min-width="160" show-overflow-tooltip />
    </el-table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="filteredList.length"
        :page-size="pageSize"
        v-model:current-page="page"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getStockMovements } from '@/api'

const allList = ref<any[]>([])
const typeFilter = ref('')
const movementFilter = ref('')
const keyword = ref('')
const page = ref(1)
const pageSize = 20

const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return allList.value.filter(m => {
    if (typeFilter.value && m.item_type !== typeFilter.value) return false
    if (movementFilter.value && m.movement_type !== movementFilter.value) return false
    if (kw) {
      if (!(m.item_code || '').toLowerCase().includes(kw) &&
          !(m.item_name || '').toLowerCase().includes(kw) &&
          !(m.operator_name || '').toLowerCase().includes(kw)) return false
    }
    return true
  })
})

const pagedList = computed(() =>
  filteredList.value.slice((page.value - 1) * pageSize, page.value * pageSize)
)

const itemTypeTag = (t: string) => ({ tool: '', spare: 'primary', consumable: 'success' }[t] || 'info')
const itemTypeText = (t: string) => ({ tool: '工具', spare: '备件', consumable: '消耗品' }[t] || t)
const movementTag = (t: string) => ({ in: 'success', out: 'danger', adjust: 'warning', borrow: 'warning', return: 'info' }[t] || 'info')
const movementText = (t: string) => ({ in: '入库', out: '出库', adjust: '调整', borrow: '借出', return: '归还' }[t] || t)

const load = async () => {
  const res: any = await getStockMovements({ limit: 10000 })
  allList.value = res.data || []
}
const reload = () => { page.value = 1; load() }

onMounted(load)
</script>
