<template>
  <div>
    <h2>物料领用单</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-input v-model="keyword" placeholder="搜索单号/领用人" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:120px">
        <el-option label="待审核" value="pending" />
        <el-option label="借出中" value="borrowed" />
        <el-option label="已归还" value="returned" />
        <el-option label="已关闭" value="closed" />
        <el-option label="已拒绝" value="rejected" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="领出开始"
        end-placeholder="领出结束"
        value-format="YYYY-MM-DD"
        style="width:260px"
      />
    </div>

    <el-table :data="filteredList" border style="margin-top:0" :row-class-name="rowClass">
      <el-table-column prop="order_no" label="单号" min-width="150" show-overflow-tooltip />
      <el-table-column prop="borrower_name" label="领用人" min-width="80" show-overflow-tooltip />
      <el-table-column label="备件明细" min-width="200" show-overflow-tooltip>
        <template #default="{row}">{{ itemsSummary(row) }}</template>
      </el-table-column>
      <el-table-column label="借出合计" width="90" align="center">
        <template #default="{row}">{{ sumBorrow(row) }}</template>
      </el-table-column>
      <el-table-column label="已归还" width="90" align="center">
        <template #default="{row}">{{ sumReturned(row) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{row}">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="borrow_time" label="领出时间" min-width="140">
        <template #default="{row}">{{ formatTime(row.borrow_time) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="280" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDetail(row)">详情</el-button>
          <el-button v-if="row.status==='pending'" size="small" type="success" @click="handleApprove(row)">批准</el-button>
          <el-button v-if="row.status==='pending'" size="small" type="danger" @click="handleReject(row)">拒绝</el-button>
          <el-button v-if="row.status==='pending'" size="small" @click="handleCancel(row)">取消</el-button>
          <el-button v-if="canReturn(row)" size="small" type="warning" @click="openReturn(row)">归还</el-button>
          <el-button v-if="canClose(row)" size="small" type="danger" plain @click="openClose(row)">关闭工单</el-button>
          <el-button v-if="canDelete(row)" size="small" type="danger" text @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="'物料单详情 - ' + (currentRow?.order_no || '')" width="760px" destroy-on-close>
      <el-descriptions :column="2" border style="margin-bottom:16px">
        <el-descriptions-item label="单号">{{ currentRow?.order_no }}</el-descriptions-item>
        <el-descriptions-item label="领用人">{{ currentRow?.borrower_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(currentRow?.status)">{{ statusText(currentRow?.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="仓库">{{ currentRow?.warehouse || '-' }}</el-descriptions-item>
        <el-descriptions-item label="场景">{{ currentRow?.scene || '-' }}</el-descriptions-item>
        <el-descriptions-item label="领出时间">{{ currentRow ? formatTime(currentRow.borrow_time) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="关闭时间">{{ currentRow?.closed_at ? formatTime(currentRow.closed_at) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="用途">{{ currentRow?.purpose || '-' }}</el-descriptions-item>
      </el-descriptions>
      <h4 style="margin:0 0 10px">备件明细</h4>
      <el-table :data="currentRow?.items || []" border size="small">
        <el-table-column prop="spare_code" label="编码" min-width="110" show-overflow-tooltip />
        <el-table-column prop="spare_name" label="名称" min-width="130" show-overflow-tooltip />
        <el-table-column label="借出" width="70" align="center">
          <template #default="{row: it}">{{ it.borrow_qty ?? 1 }}</template>
        </el-table-column>
        <el-table-column label="已归还" width="70" align="center">
          <template #default="{row: it}">{{ it.returned_qty ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="最后使用" width="90" align="center">
          <template #default="{row: it}">{{ it.last_use_qty ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="条目状态" width="100" align="center">
          <template #default="{row: it}">
            <el-tag size="small" :type="itemStatusType(it.item_status)">{{ itemStatusText(it.item_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="归还记录" min-width="150">
          <template #default="{row: it}">
            <div v-if="it.return_records?.length">
              <div v-for="r in it.return_records" :key="r.return_id" style="font-size:12px;color:#666">
                +{{ r.return_qty }} {{ formatTime(r.returned_at) }}
              </div>
            </div>
            <span v-else style="color:#bbb">-</span>
          </template>
        </el-table-column>
      </el-table>
      <div style="text-align:right;border-top:1px solid #eee;padding-top:16px;margin-top:16px">
        <el-button v-if="canReturn(currentRow)" type="warning" @click="openReturn(currentRow)">归还</el-button>
        <el-button v-if="canClose(currentRow)" type="danger" plain @click="openClose(currentRow)">关闭工单</el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </div>
    </el-dialog>

    <!-- 归还弹窗 -->
    <el-dialog v-model="returnVisible" :title="'归还 - ' + (currentRow?.order_no || '')" width="640px" destroy-on-close>
      <el-alert type="info" :closable="false" style="margin-bottom:12px">
        <template #title>按实际归还数量填写，未归还部分保持借出中；全部归还后订单变为已归还。</template>
      </el-alert>
      <el-table :data="returnRows" border size="small">
        <el-table-column prop="spare_name" label="备件" min-width="130" show-overflow-tooltip />
        <el-table-column prop="spare_code" label="编码" min-width="110" show-overflow-tooltip />
        <el-table-column label="借出" width="70" align="center">
          <template #default="{row: r}">{{ r.borrow_qty }}</template>
        </el-table-column>
        <el-table-column label="已归还" width="70" align="center">
          <template #default="{row: r}">{{ r.returned_qty }}</template>
        </el-table-column>
        <el-table-column label="本次归还" width="160">
          <template #default="{row: r}">
            <el-input-number v-model="r.return_qty" :min="0" :max="r.remaining" :precision="0" style="width:120px" />
          </template>
        </el-table-column>
        <el-table-column label="剩余可还" width="80" align="center">
          <template #default="{row: r}">{{ r.remaining }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="returnVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitReturn">确认归还</el-button>
      </template>
    </el-dialog>

    <!-- 关闭弹窗 -->
    <el-dialog v-model="closeVisible" :title="'关闭工单 - ' + (currentRow?.order_no || '')" width="640px" destroy-on-close>
      <el-alert type="warning" :closable="false" style="margin-bottom:12px">
        <template #title>未归还部分将记为使用/损耗，不再回补库存。关闭后订单为终态，不可再归还。</template>
      </el-alert>
      <el-table :data="closeRows" border size="small">
        <el-table-column prop="spare_name" label="备件" min-width="130" show-overflow-tooltip />
        <el-table-column label="借出" width="70" align="center">
          <template #default="{row: r}">{{ r.borrow_qty }}</template>
        </el-table-column>
        <el-table-column label="已归还" width="70" align="center">
          <template #default="{row: r}">{{ r.returned_qty }}</template>
        </el-table-column>
        <el-table-column label="最后使用数量" width="110" align="center">
          <template #default="{row: r}">
            <el-tag type="danger" size="small">{{ r.last_use_qty }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="closeVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="handleSubmitClose">确认关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getOrders, approveOrder, rejectOrder, returnOrder, closeOrder, cancelOrder, deleteOrder } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const dateRange = ref<string[] | null>(null)

const detailVisible = ref(false)
const currentRow = ref<any>(null)
const returnVisible = ref(false)
const returnRows = ref<any[]>([])
const closeVisible = ref(false)
const closeRows = ref<any[]>([])
const submitting = ref(false)

const load = async () => {
  list.value = await getOrders({ type: 'material' })
}

const filteredList = computed(() => {
  return list.value.filter(o => {
    if (statusFilter.value && o.status !== statusFilter.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!o.order_no?.toLowerCase().includes(kw) && !o.borrower_name?.toLowerCase().includes(kw)) return false
    }
    if (dateRange.value && dateRange.value.length === 2) {
      const day = (o.borrow_time || '').slice(0, 10)
      if (day < dateRange.value[0] || day > dateRange.value[1]) return false
    }
    return true
  })
})

const formatTime = (t: string) => t ? t.replace('T', ' ').slice(0, 19) : '-'

const statusType = (s: string) => ({ pending: 'info', approved: 'success', rejected: 'danger', borrowed: 'warning', returned: 'success', closed: 'info', cancelled: 'info' }[s] || 'info')
const statusText = (s: string) => ({ pending: '待审核', approved: '已批准', rejected: '已拒绝', borrowed: '借出中', returned: '已归还', closed: '已关闭', cancelled: '已取消' }[s] || s)
const itemStatusType = (s: string) => ({ reserved: 'info', borrowed: 'warning', returned: 'success', closed: 'info' }[s] || 'info')
const itemStatusText = (s: string) => ({ reserved: '预留中', borrowed: '借出中', returned: '已归还', closed: '已关闭' }[s] || s)

const itemsSummary = (row: any) => (row.items || []).map((it: any) => `${it.spare_name || it.tool_name}×${it.borrow_qty ?? 1}`).join('、') || '-'
const sumBorrow = (row: any) => (row.items || []).reduce((s: number, it: any) => s + (Number(it.borrow_qty) || 1), 0)
const sumReturned = (row: any) => (row.items || []).reduce((s: number, it: any) => s + (Number(it.returned_qty) || 0), 0)

const canReturn = (row: any) => row && (row.status === 'borrowed' || row.status === 'approved')
const canClose = (row: any) => row && (row.status === 'borrowed' || row.status === 'approved')
const canDelete = (row: any) => row && ['returned', 'closed', 'cancelled', 'rejected'].includes(row.status)

const rowClass = ({ row }: any) => (row.status === 'closed' ? 'closed-row' : '')

const openDetail = (row: any) => {
  currentRow.value = row
  detailVisible.value = true
}

const handleApprove = async (row: any) => {
  try {
    await approveOrder(row.order_id)
    ElMessage.success('已批准（已扣减库存）')
    detailVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '批准失败')
  }
}

const handleReject = async (row: any) => {
  try {
    await rejectOrder(row.order_id)
    ElMessage.success('已拒绝')
    detailVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '拒绝失败')
  }
}

const handleCancel = async (row: any) => {
  try {
    await cancelOrder(row.order_id)
    ElMessage.success('已取消')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '取消失败')
  }
}

// 归还
const openReturn = (row: any) => {
  currentRow.value = row
  returnRows.value = (row.items || [])
    .filter((it: any) => it.item_type === 'spare')
    .map((it: any) => {
      const borrowQty = Number(it.borrow_qty) || 1
      const returnedQty = Number(it.returned_qty) || 0
      const remaining = Math.max(0, borrowQty - returnedQty)
      return { item_id: it.item_id, spare_id: it.spare_id, spare_code: it.spare_code, spare_name: it.spare_name, borrow_qty: borrowQty, returned_qty: returnedQty, remaining, return_qty: remaining }
    })
  returnVisible.value = true
}

const handleSubmitReturn = async () => {
  if (!currentRow.value) return
  submitting.value = true
  try {
    const returns = returnRows.value
      .filter((r: any) => Number(r.return_qty) > 0)
      .map((r: any) => ({ spare_id: r.spare_id, return_qty: Number(r.return_qty) }))
    await returnOrder(currentRow.value.order_id, returns)
    ElMessage.success('归还成功')
    returnVisible.value = false
    detailVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '归还失败')
  } finally {
    submitting.value = false
  }
}

// 关闭
const openClose = (row: any) => {
  currentRow.value = row
  closeRows.value = (row.items || [])
    .filter((it: any) => it.item_type === 'spare')
    .map((it: any) => {
      const borrowQty = Number(it.borrow_qty) || 1
      const returnedQty = Number(it.returned_qty) || 0
      return { spare_id: it.spare_id, spare_code: it.spare_code, spare_name: it.spare_name, borrow_qty: borrowQty, returned_qty: returnedQty, last_use_qty: Math.max(0, borrowQty - returnedQty) }
    })
  closeVisible.value = true
}

const handleSubmitClose = async () => {
  if (!currentRow.value) return
  await ElMessageBox.confirm('确认关闭该物料工单？未归还部分将记为使用/损耗，不再回补库存。', '提示', { type: 'warning' })
  submitting.value = true
  try {
    await closeOrder(currentRow.value.order_id)
    ElMessage.success('工单已关闭')
    closeVisible.value = false
    detailVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '关闭失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm('确定删除该物料单？', '提示', { type: 'warning' })
  try {
    await deleteOrder(row.order_id)
    ElMessage.success('删除成功')
    detailVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
:deep(.closed-row) td.el-table__cell {
  background-color: #f5f7fa !important;
  color: #909399;
}
</style>
