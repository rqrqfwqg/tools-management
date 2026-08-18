<template>
  <div>
    <!-- 列表视图 -->
    <div v-if="!current">
      <h2>盘库管理</h2>
      <div style="display:flex;gap:12px;align-items:center;margin:12px 0">
        <el-button type="primary" @click="openCreateDialog">新建盘库</el-button>
      </div>
      <el-table :data="list" border>
        <el-table-column prop="check_id" label="ID" width="60" />
        <el-table-column prop="check_no" label="盘库单号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="warehouse_name" label="仓库" min-width="100" />
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{row}"><el-tag :type="row.status === 'pending' ? 'warning' : 'success'">{{ row.status === 'pending' ? '进行中' : '已完成' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="started_at" label="开始时间" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" min-width="160">
          <template #default="{row}">
            <el-button size="small" type="primary" @click="enterCheck(row)">进入</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 盘库单详情 -->
    <div v-else>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <el-button @click="backToList">← 返回列表</el-button>
        <h2 style="margin:0">盘库单 {{ current.check_no }}</h2>
        <el-tag :type="current.status === 'pending' ? 'warning' : 'success'">{{ current.status === 'pending' ? '进行中' : '已完成' }}</el-tag>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
        <el-input v-model="scanCode" placeholder="输入货位码/物料编码，回车定位" clearable style="width:280px" @keyup.enter="locateByCode" />
        <el-button type="primary" :disabled="!scanCode.trim()" @click="locateByCode">定位盘点</el-button>
        <el-button v-if="current.status === 'pending'" type="success" @click="handleComplete">完成盘库</el-button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin:8px 0 12px">
        <span style="color:#909399;font-size:13px">类型筛选：</span>
        <el-radio-group v-model="filterType" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="material">物料（备件/消耗品）</el-radio-button>
          <el-radio-button label="tool">工具</el-radio-button>
        </el-radio-group>
      </div>
      <el-alert v-if="scanHint" :type="scanHintType" :closable="false" style="margin-bottom:12px" :title="scanHint" />
      <el-table :data="filteredItems" border ref="tableRef" :row-class-name="rowClassName">
        <el-table-column label="类型" width="90">
          <template #default="{row}"><el-tag :type="row.item_type === 'spare' ? 'primary' : row.item_type === 'consumable' ? 'success' : ''">{{ itemTypeText(row.item_type) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="item_code" label="编码" min-width="100" />
        <el-table-column prop="item_name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="system_qty" label="系统数量" width="100" />
        <el-table-column label="实盘数量" width="150">
          <template #default="{row}">
            <!-- 工具：逐件切换（在库/盘亏），不显示数字框 -->
            <el-switch
              v-if="row.item_type === 'tool'"
              :model-value="row.actual_qty === 1"
              inline-prompt
              active-text="在库"
              inactive-text="盘亏"
              @change="onToolToggle(row)"
            />
            <!-- 备件/消耗品：行内直接编辑数量；未录入时默认显示系统库存，便于直接核对/微调 -->
            <el-input-number
              v-else
              :model-value="row.actual_qty != null ? row.actual_qty : row.system_qty"
              :min="0"
              :max="999999"
              controls-position="right"
              size="small"
              style="width:120px"
              @change="onQtyChange(row, $event)"
              @blur="onQtyBlur(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="差异" width="90">
          <template #default="{row}">
            <el-tag :type="row.diff === 0 ? 'success' : 'danger'">{{ row.diff }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建盘库对话框 -->
    <el-dialog v-model="createVisible" title="新建盘库" width="420px">
      <el-form label-width="80px">
        <el-form-item label="仓库">
          <el-select v-model="newWarehouseId" placeholder="请选择仓库" style="width:100%">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="newOperator" placeholder="默认当前登录用户" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { getInventoryChecks, createInventoryCheck, scanInventoryCheck, resolveInventoryCheck, completeInventoryCheck, getWarehouses } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const current = ref<any>(null)
const warehouses = ref<any[]>([])
const createVisible = ref(false)
const newWarehouseId = ref<number | undefined>(undefined)
const newOperator = ref('')
const creating = ref(false)

const scanCode = ref('')
// 类型筛选：全部 / 物料（备件+消耗品）/ 工具
const filterType = ref<'all' | 'material' | 'tool'>('all')
// 定位高亮 + 表格 ref（用于滚动定位）
const highlightCode = ref('')
const tableRef = ref<any>(null)
const scanHint = ref('')
const scanHintType = ref<any>('info')

const itemTypeText = (t: string) => ({ spare: '备件', consumable: '消耗品', tool: '工具' }[t] || t)

// 类型筛选后的显示列表
const filteredItems = computed(() => {
  const items = (current.value?.items || []) as any[]
  if (filterType.value === 'all') return items
  if (filterType.value === 'material') return items.filter((it) => it.item_type === 'spare' || it.item_type === 'consumable')
  return items.filter((it) => it.item_type === 'tool')
})

// 高亮命中行（row-class-name 回调）
const rowClassName = ({ row }: any) => (row.item_code === highlightCode.value ? 'inv-row-highlight' : '')

// 本地"已录入"标记（FIX-4：与 H5/小程序 useInventoryEntered 同口径，key 约定一致），
// 用于区分"已扫过（含刻意记为 0）"与"未扫（预置 actual=0）"，避免完成盘库误清零。
const ENTERED_KEY_PREFIX = 'inventory_entered_'
function getEnteredCodes(checkId: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${ENTERED_KEY_PREFIX}${checkId}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}
function markEntered(checkId: number, code: string): void {
  try {
    const set = getEnteredCodes(checkId)
    set.add(code)
    localStorage.setItem(`${ENTERED_KEY_PREFIX}${checkId}`, JSON.stringify([...set]))
  } catch {
    // 忽略写入异常（隐私模式等场景），不影响主流程
  }
}

const load = async () => { list.value = await getInventoryChecks() }
const loadWarehouses = async () => { warehouses.value = await getWarehouses() }

const openCreateDialog = () => { newWarehouseId.value = undefined; newOperator.value = ''; createVisible.value = true }
const handleCreate = async () => {
  if (!newWarehouseId.value) { ElMessage.warning('请选择仓库'); return }
  creating.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const operator = newOperator.value || user.real_name || user.username || ''
    const check = await createInventoryCheck({ warehouse_id: newWarehouseId.value, operator })
    ElMessage.success('盘库单已创建'); createVisible.value = false
    await load(); enterCheck(check)
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '创建失败') } finally { creating.value = false }
}

const enterCheck = async (row: any) => {
  // 优先用列表已有的 items，避免额外请求；列表项字段已包含 items
  current.value = row
  scanHint.value = ''
  highlightCode.value = ''
  filterType.value = 'all'
}
const backToList = () => { current.value = null; load() }

// 顶部输码/扫码 → 定位聚焦（不再弹窗录入）
// 优先按物料编码在清单内定位；若未命中，尝试按货位码 resolve 解析该货位上的物料后定位。
// 找到对应行：高亮 + 滚动可见 + 聚焦其数量输入框
const locateByCode = async () => {
  const code = scanCode.value.trim().toUpperCase()
  if (!code) { ElMessage.warning('请输入编码'); return }
  if (!current.value || current.value.status !== 'pending') { ElMessage.warning('当前盘库单不可录入'); return }
  const items = (current.value.items || []) as any[]
  let target = items.find((it: any) => it.item_code === code)
  if (!target) {
    // 可能输入的是货位码（货位一码一种物料）→ resolve 解析该货位上的物料
    try {
      const resolved: any = await resolveInventoryCheck(current.value.check_id, code)
      if (!resolved?.item_code) { ElMessage.error('无法识别的编码（应为货位码或物料编码）'); return }
      target = items.find((it: any) => it.item_code === resolved.item_code)
      if (!target) { ElMessage.warning(`「${resolved.item_name}」不在本次盘点范围`); return }
      scanHint.value = `货位 ${resolved.location?.location_code}（${resolved.location?.shelf_name || ''}${resolved.location?.location_name || ''}）→ ${resolved.item_name}，系统库存 ${resolved.system_qty}`
      scanHintType.value = 'info'
    } catch (e: any) {
      ElMessage.error(e.response?.data?.message || '编码无法解析'); return
    }
  }
  if (!target) return

  // 若该行被类型筛选隐藏，先切回"全部"以保证可见
  const isMaterial = target.item_type === 'spare' || target.item_type === 'consumable'
  if (filterType.value === 'material' && !isMaterial) filterType.value = 'all'
  if (filterType.value === 'tool' && target.item_type !== 'tool') filterType.value = 'all'

  highlightCode.value = code
  scanCode.value = ''
  // 高亮自动淡出（避免覆盖后续高亮）
  setTimeout(() => { if (highlightCode.value === code) highlightCode.value = '' }, 2000)

  nextTick(() => {
    const tableEl = tableRef.value?.$el as HTMLElement | undefined
    const rowEl = tableEl?.querySelector('.inv-row-highlight') as HTMLElement | null
    if (rowEl) rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // 聚焦对应编辑控件
    if (target.item_type === 'tool') {
      (rowEl?.querySelector('.el-switch') as HTMLElement | null)?.focus?.()
    } else {
      (rowEl?.querySelector('.el-input-number .el-input__inner') as HTMLElement | null)?.focus?.()
    }
  })
}

// 备件/消耗品：行内直接编辑数量，失焦/回车即同步
const submitQty = async (row: any, val: number) => {
  if (!current.value || current.value.status !== 'pending') return
  let v = Math.floor(Number(val))
  if (!Number.isFinite(v) || v < 0) v = 0 // 钳制非负整数
  const old = row.actual_qty
  try {
    const res: any = await scanInventoryCheck(current.value.check_id, row.item_code, v)
    row.actual_qty = res?.item?.actual_qty ?? v
    row.diff = row.actual_qty - row.system_qty
    markEntered(current.value.check_id, row.item_code)
    scanHint.value = `已录入：${row.item_code} 实盘 ${row.actual_qty}（差异 ${row.diff}）`
    scanHintType.value = row.diff === 0 ? 'success' : 'warning'
  } catch (e: any) {
    row.actual_qty = old // 失败回滚显示
    ElMessage.error(e.response?.data?.message || '录入失败')
    throw e
  }
}

// 用户改了数量 → 提交
const onQtyChange = (row: any, val: number) => { submitQty(row, val).catch(() => {}) }

// 用户聚焦后未改动即失焦（数量仍为默认的系统库存）→ 视为"已核对，无误"，提交系统库存以标记为已录入（差异 0，不生成流水）
const onQtyBlur = (row: any) => {
  if (!current.value || current.value.status !== 'pending') return
  if (row.item_type === 'tool') return // 工具走逐件切换，无数字框失焦
  if (row.actual_qty != null) return   // 已录入过则不再重复提交
  submitQty(row, row.system_qty).catch(() => {})
}

// 工具：逐件切换（在库 1 / 盘亏 0）
const onToolToggle = async (row: any) => {
  if (!current.value) return
  const newVal = row.actual_qty ? 0 : 1 // 点击切换
  try {
    const res: any = await scanInventoryCheck(current.value.check_id, row.item_code, newVal)
    row.actual_qty = res?.item?.actual_qty ?? newVal
    row.diff = row.actual_qty - row.system_qty
    markEntered(current.value.check_id, row.item_code)
    scanHint.value = `已录入：${row.item_code} ${row.actual_qty ? '在库' : '盘亏'}`
    scanHintType.value = 'success'
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '录入失败')
  }
}

const handleComplete = async () => {
  if (!current.value) return
  await ElMessageBox.confirm('完成后将无法继续录入；未录入的物料保持原库存不变（仅已录入且有差异的项生成出入库流水）。确认完成？', '提示', { type: 'warning' })
  try {
    const checkId = current.value.check_id
    await completeInventoryCheck(checkId)
    ElMessage.success('盘库已完成，差异已生成出入库流水')
    backToList()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '完成失败') }
}

onMounted(() => { load(); loadWarehouses() })
</script>
<style>
/* 盘库定位高亮行（el-table 行 tr 不在 SFC 作用域内，用全局样式保证生效） */
.inv-row-highlight > td {
  background-color: #fff7e6 !important;
}
</style>
