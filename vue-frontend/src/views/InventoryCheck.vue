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
        <el-input v-model="scanCode" placeholder="手动输入编码（BJ-/XH-/G-）" clearable style="width:280px" @keyup.enter="openScanConfirm" />
        <el-button type="primary" :disabled="!scanCode.trim()" @click="openScanConfirm">扫码盘点</el-button>
        <el-button v-if="current.status === 'pending'" type="success" @click="handleComplete">完成盘库</el-button>
      </div>
      <el-alert v-if="scanHint" :type="scanHintType" :closable="false" style="margin-bottom:12px" :title="scanHint" />
      <el-table :data="current.items || []" border>
        <el-table-column label="类型" width="90">
          <template #default="{row}"><el-tag :type="row.item_type === 'spare' ? 'primary' : row.item_type === 'consumable' ? 'success' : ''">{{ itemTypeText(row.item_type) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="item_code" label="编码" min-width="100" />
        <el-table-column prop="item_name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="system_qty" label="系统数量" width="100" />
        <el-table-column label="实盘数量" width="100">
          <template #default="{row}">
            <span :style="{ color: row.actual_qty === 0 ? '#f56c6c' : '#303133', fontWeight: 'bold' }">{{ row.actual_qty }}</span>
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

    <!-- 扫码盘点：数量录入 -->
    <el-dialog v-model="scanVisible" title="录入实盘数量" width="420px">
      <div v-if="scanMeta">
        <p>编码：<strong>{{ scanMeta.code }}</strong></p>
        <p>名称：<strong>{{ scanMeta.name }}</strong></p>
        <p>类型：<el-tag :type="scanMeta.type === 'spare' ? 'primary' : scanMeta.type === 'consumable' ? 'success' : ''">{{ itemTypeText(scanMeta.type) }}</el-tag></p>
        <p v-if="scanMeta.system_qty != null">系统数量：<strong>{{ scanMeta.system_qty }}</strong></p>
      </div>
      <el-alert v-if="scanMeta && scanMeta.type === 'spare'" type="info" :closable="false" style="margin:8px 0" title="备件实盘数量支持录入大于 1 的整数（与数量库存口径一致）" />
      <el-form label-width="90px" style="margin-top:8px">
        <el-form-item label="实盘数量">
          <el-input-number v-model="scanQty" :min="0" :max="999999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scanVisible=false">取消</el-button>
        <el-button type="primary" :loading="scanning" @click="handleScanSubmit">确认录入</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getInventoryChecks, createInventoryCheck, scanInventoryCheck, completeInventoryCheck, getWarehouses } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const current = ref<any>(null)
const warehouses = ref<any[]>([])
const createVisible = ref(false)
const newWarehouseId = ref<number | undefined>(undefined)
const newOperator = ref('')
const creating = ref(false)

const scanCode = ref('')
const scanVisible = ref(false)
const scanMeta = ref<any>(null)
const scanQty = ref(1)
const scanning = ref(false)
const scanHint = ref('')
const scanHintType = ref<any>('info')

const itemTypeText = (t: string) => ({ spare: '备件', consumable: '消耗品', tool: '工具' }[t] || t)

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
}
const backToList = () => { current.value = null; load() }

const detectPrefix = (code: string) => {
  if (code.startsWith('BJ-')) return 'spare'
  if (code.startsWith('XH-')) return 'consumable'
  if (code.startsWith('G-') || code.startsWith('BX-')) return 'tool'
  return ''
}

const openScanConfirm = () => {
  const code = scanCode.value.trim()
  if (!code) { ElMessage.warning('请输入编码'); return }
  if (!current.value || current.value.status !== 'pending') { ElMessage.warning('当前盘库单不可录入'); return }
  const type = detectPrefix(code)
  if (!type) { ElMessage.error('无法识别的编码前缀（应为 BJ-/XH-）'); return }
  // 决策 #7：盘点范围仅备件+消耗品；扫到 G-(工具)/BX-(工具箱) → 不在本次盘点范围，不调接口不追加
  if (type === 'tool') { ElMessage.warning('不在本次盘点范围'); return }
  const existing = (current.value.items || []).find((it: any) => it.item_code === code)
  if (!existing) { ElMessage.warning('不在本次盘点范围'); return }
  scanMeta.value = {
    code,
    type,
    name: existing?.item_name || '',
    system_qty: existing?.system_qty != null ? existing.system_qty : null
  }
  scanQty.value = existing?.system_qty != null ? existing.system_qty : 0
  scanVisible.value = true
}

const handleScanSubmit = async () => {
  if (!scanMeta.value || !current.value) return
  scanning.value = true
  try {
    const res: any = await scanInventoryCheck(current.value.check_id, scanMeta.value.code, scanQty.value)
    scanVisible.value = false
    scanHint.value = `已录入：${res.item?.item_code} 实盘 ${res.item?.actual_qty}（差异 ${res.item?.diff}）`
    scanHintType.value = res.item?.diff === 0 ? 'success' : 'warning'
    scanCode.value = ''
    // 刷新当前盘库单（含最新 items）
    const fresh: any = await getInventoryChecks()
    const updated = fresh.find((c: any) => c.check_id === current.value!.check_id)
    if (updated) current.value = updated
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '录入失败') } finally { scanning.value = false }
}

const handleComplete = async () => {
  if (!current.value) return
  await ElMessageBox.confirm('完成后将无法继续录入，确认完成？', '提示', { type: 'warning' })
  try {
    await completeInventoryCheck(current.value.check_id)
    ElMessage.success('盘库已完成'); backToList()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '完成失败') }
}

onMounted(() => { load(); loadWarehouses() })
</script>
