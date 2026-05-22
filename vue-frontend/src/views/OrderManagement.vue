<template>
  <div>
    <h2>领用管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-input v-model="keyword" placeholder="搜索单号/领用人" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:120px">
        <el-option label="待审核" value="pending" />
        <el-option label="已批准" value="approved" />
        <el-option label="借出中" value="borrowed" />
        <el-option label="已归还" value="returned" />
        <el-option label="已拒绝" value="rejected" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:120px">
        <el-option v-for="w in warehouseList" :key="w" :label="w" :value="w" />
      </el-select>
    </div>
    <el-table
      :data="filteredList"
      style="margin-top:15px"
      row-class-name="clickable-row"
      @row-click="handleRowClick"
    >
      <el-table-column prop="order_no" label="单号" width="160" />
      <el-table-column prop="borrower_name" label="领用人" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{row}">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="warehouse" label="仓库" width="100" />
      <el-table-column prop="scene" label="场景" width="100" />
      <el-table-column prop="borrow_time" label="借出时间" width="160">
        <template #default="{row}">{{ formatTime(row.borrow_time) }}</template>
      </el-table-column>
      <el-table-column prop="actual_return" label="实际归还" width="160">
        <template #default="{row}">{{ row.actual_return ? formatTime(row.actual_return) : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="380" fixed="right">
        <template #default="{row}">
          <el-button size="small" type="info" @click.stop="handlePrint(row)">
            <el-icon><Printer /></el-icon> 打印
          </el-button>
          <el-button v-if="row.status==='pending'" size="small" type="success" @click.stop="handleApprove(row.order_id)">批准</el-button>
          <el-button v-if="row.status==='pending'" size="small" type="danger" @click.stop="handleReject(row.order_id)">拒绝</el-button>
          <el-button v-if="row.status==='borrowed' || row.status==='approved'" size="small" type="warning" @click.stop="handleReturn(row.order_id)">归还</el-button>
          <el-button v-if="row.status==='pending'" size="small" @click.stop="handleCancel(row.order_id)">取消</el-button>
          <el-button size="small" type="danger" plain @click.stop="handleDelete(row.order_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 工单详情弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="'工单详情 - ' + (currentRow?.order_no || '')"
      width="700px"
      destroy-on-close
    >
      <!-- 基本信息 -->
      <el-descriptions :column="2" border style="margin-bottom:20px">
        <el-descriptions-item label="单号">{{ currentRow?.order_no }}</el-descriptions-item>
        <el-descriptions-item label="领用人">{{ currentRow?.borrower_name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(currentRow?.status)">{{ statusText(currentRow?.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="仓库">{{ currentRow?.warehouse }}</el-descriptions-item>
        <el-descriptions-item label="场景">{{ currentRow?.scene }}</el-descriptions-item>
        <el-descriptions-item label="借出时间">{{ currentRow ? formatTime(currentRow.borrow_time) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="实际归还时间">{{ currentRow?.actual_return ? formatTime(currentRow.actual_return) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="用途">{{ currentRow?.purpose || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 工具明细 -->
      <h4 style="margin:0 0 10px">工具明细
        <el-tag size="small" style="margin-left:10px">{{ currentRow?.items?.length || 0 }} 件</el-tag>
      </h4>
      <el-table :data="currentRow?.items || []" border size="small" style="margin-bottom:20px">
        <el-table-column label="图片" width="70" align="center">
          <template #default="{row: item}">
            <el-image
              v-if="toolImages[item.tool_id]"
              :src="toolImages[item.tool_id]"
              fit="cover"
              style="width:50px;height:50px;border-radius:4px"
              :preview-src-list="[toolImages[item.tool_id]]"
              preview-teleported
            />
            <div v-else style="width:50px;height:50px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;margin:0 auto">
              <el-icon style="font-size:20px;color:#ccc"><Picture /></el-icon>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="tool_code" label="工具编码" />
        <el-table-column prop="tool_name" label="工具名称" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{row: item}">
            <el-tag size="small" :type="itemStatusType(item.item_status)">
              {{ itemStatusText(item.item_status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 操作按钮区 -->
      <div style="text-align:right;border-top:1px solid #eee;padding-top:16px">
        <el-button type="info" @click="handlePrint(currentRow)">
          <el-icon><Printer /></el-icon> 打印
        </el-button>
        <el-button v-if="currentRow?.status==='pending'" type="success" @click="handleApprove(currentRow.order_id)">批准</el-button>
        <el-button v-if="currentRow?.status==='pending'" type="danger" @click="handleReject(currentRow.order_id)">拒绝</el-button>
        <el-button v-if="currentRow?.status==='borrowed' || currentRow?.status==='approved'" type="warning" @click="handleReturn(currentRow.order_id)">归还</el-button>
        <el-button v-if="currentRow?.status==='pending'" @click="handleCancel(currentRow.order_id)">取消</el-button>
        <el-button type="danger" plain @click="handleDelete(currentRow.order_id)">删除</el-button>
      </div>
    </el-dialog>

    <!-- 打印区域（不显示，仅供打印使用） -->
    <div ref="printArea" class="print-container" style="display:none">
      <div class="print-content" style="font-family:'Microsoft YaHei','SimSun',serif;font-size:14px;padding:15mm 20mm;width:210mm;box-sizing:border-box;background:#fff;">
        <!-- 表头区域 -->
        <div style="text-align:center;margin-bottom:8mm;">
          <div style="font-size:10px;color:#666;margin-bottom:5px;">编号：{{ printOrder?.order_no || '________________' }}</div>
          <h1 style="font-size:24px;font-weight:bold;margin:0 0 5px;letter-spacing:4px;">工器具领用单</h1>
          <div style="border-bottom:2px solid #000;margin-top:8px;"></div>
        </div>

        <!-- 基本信息表 -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:6mm;">
          <tr>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;width:18%;">单号</td>
            <td style="padding:6px 10px;border:1px solid #000;width:32%;">{{ printOrder?.order_no }}</td>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;width:18%;">状态</td>
            <td style="padding:6px 10px;border:1px solid #000;width:32%;">{{ printOrder ? statusText(printOrder.status) : '' }}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;">领用人</td>
            <td style="padding:6px 10px;border:1px solid #000;">{{ printOrder?.borrower_name }}</td>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;">借出时间</td>
            <td style="padding:6px 10px;border:1px solid #000;">{{ printOrder ? formatTime(printOrder.borrow_time) : '' }}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;">仓库</td>
            <td style="padding:6px 10px;border:1px solid #000;">{{ printOrder?.warehouse }}</td>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;">归还时间</td>
            <td style="padding:6px 10px;border:1px solid #000;">{{ printOrder?.actual_return ? formatTime(printOrder.actual_return) : '未归还' }}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px;border:1px solid #000;background:#f5f5f5;font-weight:bold;">用途</td>
            <td colspan="3" style="padding:6px 10px;border:1px solid #000;">{{ printOrder?.purpose || '-' }}</td>
          </tr>
        </table>

        <!-- 工具明细表 -->
        <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">工具明细</div>
        <table class="print-tool-table" style="width:100%;border-collapse:collapse;margin-bottom:10mm;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #000;background:#e8e8e8;font-weight:bold;text-align:center;width:10%;">序号</th>
              <th style="padding:8px;border:1px solid #000;background:#e8e8e8;font-weight:bold;text-align:center;width:25%;">工具编码</th>
              <th style="padding:8px;border:1px solid #000;background:#e8e8e8;font-weight:bold;text-align:center;width:35%;">工具名称</th>
              <th style="padding:8px;border:1px solid #000;background:#e8e8e8;font-weight:bold;text-align:center;width:15%;">数量</th>
              <th style="padding:8px;border:1px solid #000;background:#e8e8e8;font-weight:bold;text-align:center;width:15%;">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in printOrder?.items" :key="item.item_id">
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">{{ index + 1 }}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">{{ item.tool_code }}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">{{ item.tool_name }}</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">1</td>
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">{{ itemStatusText(item.item_status) }}</td>
            </tr>
            <!-- 空行填充 -->
            <tr v-for="n in Math.max(0, 5 - (printOrder?.items?.length || 0))" :key="'empty-' + n">
              <td style="padding:6px 8px;border:1px solid #000;text-align:center;">&nbsp;</td>
              <td style="padding:6px 8px;border:1px solid #000;">&nbsp;</td>
              <td style="padding:6px 8px;border:1px solid #000;">&nbsp;</td>
              <td style="padding:6px 8px;border:1px solid #000;">&nbsp;</td>
              <td style="padding:6px 8px;border:1px solid #000;">&nbsp;</td>
            </tr>
          </tbody>
        </table>

        <!-- 签字栏 -->
        <div class="sign-section" style="margin-top:8mm;">
          <div style="border-top:1px solid #333;padding-top:4px;margin-bottom:6mm;">
            <span style="font-size:10px;color:#666;">备注：{{ printOrder?.scene ? '场景：' + printOrder.scene : '本单据一式两份，领用方与仓库管理员各执一份' }}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;padding:8px;vertical-align:top;">
                <div style="line-height:2.2;">
                  <span style="font-weight:bold;">领用人签字：</span>____________________
                </div>
                <div style="line-height:2.2;margin-top:8px;">
                  <span style="font-weight:bold;">日&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;期：</span>____年____月____日
                </div>
              </td>
              <td style="width:50%;padding:8px;vertical-align:top;">
                <div style="line-height:2.2;">
                  <span style="font-weight:bold;">管理员签字：</span>____________________
                </div>
                <div style="line-height:2.2;margin-top:8px;">
                  <span style="font-weight:bold;">日&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;期：</span>____年____月____日
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- 页脚 -->
        <div style="margin-top:12mm;text-align:center;font-size:10px;color:#999;">
          <div style="border-top:1px solid #ddd;padding-top:4px;">
            打印时间：{{ new Date().toLocaleString('zh-CN') }}&nbsp;&nbsp;|&nbsp;&nbsp;共 {{ printOrder?.items?.length || 0 }} 件工具
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getOrders, approveOrder, rejectOrder, returnOrder, cancelOrder, deleteOrder, getTools } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Printer } from '@element-plus/icons-vue'

const route = useRoute()
const list = ref<any[]>([])
const toolImages = ref<Record<number, string>>({})
const printOrder = ref<any>(null)
const printArea = ref<any>(null)
const BACKEND_BASE = ''
const statusFilter = ref('')
const warehouseFilter = ref('')
const keyword = ref('')
const warehouseList = ref<string[]>([])

// 筛选后的列表
const filteredList = computed(() => {
  return list.value.filter(o => {
    if (statusFilter.value && o.status !== statusFilter.value) return false
    if (warehouseFilter.value && o.warehouse !== warehouseFilter.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!o.order_no?.toLowerCase().includes(kw) && !o.borrower_name?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

// 弹窗相关状态
const dialogVisible = ref(false)
const currentRow = ref<any>(null)

const getImageUrl = (path: string) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${BACKEND_BASE}${path}`
}

const load = async () => {
  list.value = await getOrders()
  // 提取仓库列表（去重）
  const whSet = new Set<string>()
  list.value.forEach((o: any) => { if (o.warehouse) whSet.add(o.warehouse) })
  warehouseList.value = Array.from(whSet)
  // 加载工具图片映射
  const tools = await getTools()
  tools.forEach((t: any) => {
    if (t.image_url) {
      toolImages.value[t.tool_id] = getImageUrl(t.image_url)
    }
  })
}

const formatTime = (t: string) => t ? t.replace('T', ' ').slice(0, 19) : '-'

const statusType = (s: string) => ({ pending: 'info', approved: 'success', rejected: 'danger', borrowed: 'warning', returned: 'success', cancelled: 'info' }[s] || 'info')
const statusText = (s: string) => ({ pending: '待审核', approved: '已批准', rejected: '已拒绝', borrowed: '借出中', returned: '已归还', cancelled: '已取消' }[s] || s)
const itemStatusType = (s: string) => ({ reserved: 'info', borrowed: 'warning', returned: 'success' }[s] || 'info')
const itemStatusText = (s: string) => ({ reserved: '预留中', borrowed: '借出中', returned: '已归还' }[s] || s)

/** 点击表格行，打开详情弹窗 */
const handleRowClick = (row: any) => {
  currentRow.value = row
  dialogVisible.value = true
}

const handlePrint = (row: any) => {
  printOrder.value = row
  // 显示打印区域
  if (printArea.value) {
    printArea.value.style.display = 'block'
  }
  // 触发打印
  setTimeout(() => {
    window.print()
    // 打印后隐藏打印区域
    if (printArea.value) {
      printArea.value.style.display = 'none'
    }
  }, 100)
}

const handleApprove = async (id: number) => {
  await approveOrder(id)
  ElMessage.success('已批准')
  dialogVisible.value = false
  load()
}
const handleReject = async (id: number) => {
  await rejectOrder(id)
  ElMessage.success('已拒绝')
  dialogVisible.value = false
  load()
}
const handleReturn = async (id: number) => {
  await returnOrder(id)
  ElMessage.success('已归还')
  dialogVisible.value = false
  load()
}
const handleCancel = async (id: number) => {
  await cancelOrder(id)
  ElMessage.success('已取消')
  dialogVisible.value = false
  load()
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该订单？', '提示', { type: 'warning' })
  try {
    await deleteOrder(id)
    ElMessage.success('删除成功')
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(() => {
  load()
  // 从仪表盘跳转时自动筛选
  if (route.query.status) statusFilter.value = route.query.status as string
})
</script>

<style scoped>
/* 可点击行样式：鼠标变手型 */
:deep(.clickable-row) {
  cursor: pointer;
}

@media print {
  body > * {
    display: none !important;
  }
  body > .print-container,
  body > .print-container * {
    display: block !important;
    visibility: visible !important;
  }
  .print-container {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    z-index: 99999 !important;
    background: white !important;
  }
  .print-content {
    width: 190mm !important;
    margin: 0 auto !important;
    font-family: 'SimSun', 'Microsoft YaHei', 'FangSong', serif !important;
  }
  /* 分页控制：避免在行中间分页 */
  .print-tool-table {
    page-break-inside: auto;
  }
  .print-tool-table tr {
    page-break-inside: avoid;
  }
  .print-tool-table thead {
    display: table-header-group;
  }
  /* 签字栏另起一页（工具多时） */
  .sign-section {
    page-break-before: auto;
  }
}
</style>
