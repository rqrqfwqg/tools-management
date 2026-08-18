<template>
  <div>
    <h2>入库单管理</h2>

    <!-- 建单表单 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>新建入库单（物料管理员）</span>
      </template>
      <el-form :inline="true" label-width="80px">
        <el-form-item label="物料类型">
          <el-radio-group v-model="form.item_type">
            <el-radio-button label="spare">备件</el-radio-button>
            <el-radio-button label="consumable">消耗品</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="物料">
          <el-select v-model="form.item_code" filterable placeholder="搜索并选择物料" style="width:260px">
            <el-option v-for="m in materialOptions" :key="m.code" :label="`${m.code} - ${m.name}`" :value="m.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="form.qty" :min="1" :max="999999" style="width:140px" />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouse_id" placeholder="选择仓库" style="width:160px" @change="onWarehouseChange">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架">
          <el-select v-model="form.shelf_id" placeholder="选择货架" style="width:140px" @change="onShelfChange">
            <el-option v-for="s in shelves" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货位">
          <el-select v-model="form.location_code" placeholder="选择货位（货位一码一种物料）" style="width:220px">
            <el-option v-for="l in locations" :key="l.location_id" :label="`${l.location_code} ${l.location_name || ''}`" :value="l.location_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选" style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="creating" @click="handleCreate">生成入库单</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>入库单列表</span>
          <el-radio-group v-model="statusFilter" size="small" @change="load">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="pending">待入库</el-radio-button>
            <el-radio-button label="received">已入库</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-table :data="orders" border v-loading="loading">
        <el-table-column prop="order_no" label="入库单号" min-width="150" />
        <el-table-column label="物料" min-width="180" show-overflow-tooltip>
          <template #default="{row}">
            <el-tag size="small" :type="row.item_type === 'spare' ? 'primary' : 'success'">{{ row.item_type === 'spare' ? '备件' : '消耗品' }}</el-tag>
            {{ row.item_code }} {{ row.item_name }}
          </template>
        </el-table-column>
        <el-table-column prop="qty" label="数量" width="80" />
        <el-table-column label="目标货位" min-width="120">
          <template #default="{row}">{{ row.location_code }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{row}">
            <el-tag :type="row.status === 'pending' ? 'warning' : 'success'">{{ row.status === 'pending' ? '待入库' : '已入库' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="建单人" width="90" />
        <el-table-column prop="created_at" label="建单时间" min-width="150" show-overflow-tooltip />
        <el-table-column prop="receiver_name" label="收货人" width="90">
          <template #default="{row}">{{ row.receiver_name || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button v-if="row.status === 'pending'" size="small" type="success" @click="openReceive(row)">扫码收货</el-button>
            <span v-else style="color:#909399;font-size:12px">{{ row.received_at }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 收货弹窗 -->
    <el-dialog v-model="receiveVisible" title="扫码收货" width="460px">
      <el-form label-width="90px">
        <el-form-item label="入库单">
          <span>{{ receiveTarget?.order_no }}（{{ receiveTarget?.item_code }} {{ receiveTarget?.item_name }} × {{ receiveTarget?.qty }}）</span>
        </el-form-item>
        <el-form-item label="目标货位">
          <span>{{ receiveTarget?.location_code }}</span>
        </el-form-item>
        <el-form-item label="扫码货位码">
          <el-input v-model="receiveLocationCode" placeholder="扫货位二维码，须与单据货位一致" clearable />
        </el-form-item>
        <el-form-item label="实收数量">
          <el-input-number v-model="receiveQty" :min="1" :max="999999" style="width:160px" :placeholder="`默认 ${receiveTarget?.qty}`" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="receiveVisible=false">取消</el-button>
        <el-button type="primary" :loading="receiving" @click="handleReceive">确认收货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getWarehouses, getShelves, getStorageLocations, getSpareParts, getConsumables,
  createInboundOrder, getInboundOrders, receiveInboundOrder
} from '@/api'

const form = ref<any>({ item_type: 'spare', item_code: '', qty: 1, warehouse_id: undefined, shelf_id: undefined, location_code: '', remark: '' })
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const spareParts = ref<any[]>([])
const consumables = ref<any[]>([])
const creating = ref(false)
const orders = ref<any[]>([])
const loading = ref(false)
const statusFilter = ref('')

const materialOptions = computed(() => {
  const list = form.value.item_type === 'consumable' ? consumables.value : spareParts.value
  const codeKey = form.value.item_type === 'consumable' ? 'consumable_code' : 'spare_code'
  const nameKey = form.value.item_type === 'consumable' ? 'consumable_name' : 'spare_name'
  return list.map((m: any) => ({ code: m[codeKey], name: m[nameKey] }))
})

const receiveVisible = ref(false)
const receiveTarget = ref<any>(null)
const receiveLocationCode = ref('')
const receiveQty = ref<number | undefined>(undefined)
const receiving = ref(false)

const load = async () => {
  loading.value = true
  try {
    orders.value = await getInboundOrders(statusFilter.value ? { status: statusFilter.value } : {})
  } finally { loading.value = false }
}

const loadWarehouses = async () => { warehouses.value = await getWarehouses() }
const onWarehouseChange = async () => {
  form.value.shelf_id = undefined; form.value.location_code = ''
  shelves.value = await getShelves({ warehouse_id: form.value.warehouse_id })
  locations.value = []
}
const onShelfChange = async () => {
  form.value.location_code = ''
  locations.value = await getStorageLocations({ shelf_id: form.value.shelf_id })
}

const handleCreate = async () => {
  if (!form.value.item_code) { ElMessage.warning('请选择物料'); return }
  if (!form.value.warehouse_id) { ElMessage.warning('请选择仓库'); return }
  if (!form.value.location_code) { ElMessage.warning('请选择目标货位'); return }
  creating.value = true
  try {
    const order = await createInboundOrder({
      item_type: form.value.item_type,
      item_code: form.value.item_code,
      qty: form.value.qty,
      warehouse_id: form.value.warehouse_id,
      shelf_id: form.value.shelf_id || undefined,
      location_code: form.value.location_code,
      remark: form.value.remark
    })
    ElMessage.success(`入库单 ${order.order_no} 已生成`)
    form.value = { item_type: 'spare', item_code: '', qty: 1, warehouse_id: undefined, shelf_id: undefined, location_code: '', remark: '' }
    await load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '生成失败') } finally { creating.value = false }
}

const openReceive = (row: any) => {
  receiveTarget.value = row
  receiveLocationCode.value = ''
  receiveQty.value = undefined
  receiveVisible.value = true
}

const handleReceive = async () => {
  if (!receiveTarget.value) return
  if (!receiveLocationCode.value.trim()) { ElMessage.warning('请扫码或输入货位码'); return }
  receiving.value = true
  try {
    const updated = await receiveInboundOrder(receiveTarget.value.order_id, {
      location_code: receiveLocationCode.value.trim(),
      actual_qty: receiveQty.value
    })
    ElMessage.success(`已收货 ${updated.received_qty}，库存已更新`)
    receiveVisible.value = false
    await load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '收货失败') } finally { receiving.value = false }
}

onMounted(async () => {
  await Promise.all([load(), loadWarehouses(), getSpareParts().then(r => spareParts.value = r), getConsumables().then(r => consumables.value = r)])
})
</script>
