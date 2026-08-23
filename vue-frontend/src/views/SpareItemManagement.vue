<template>
  <div>
    <h2>备件实例管理（一物一码）</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openBatchDialog">批量生成二维码</el-button>
      <el-button type="success" @click="batchPrint"><el-icon style="margin-right:4px"><Printer /></el-icon>批量打印二维码</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码/型号" clearable prefix-icon="Search" style="width:200px" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:130px">
        <el-option label="在库" value="available" />
        <el-option label="借出" value="borrowed" />
        <el-option label="维修" value="maintenance" />
        <el-option label="报废" value="scrap" />
      </el-select>
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:140px">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
      </el-select>
      <el-button @click="load"><el-icon style="margin-right:4px"><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-alert type="info" :closable="false" style="margin-bottom:12px">
      每件实物一个二维码，同一货位可存放多个备件。库存数量 = 在库（available）实物件数。
    </el-alert>

    <el-table :data="filteredList" border>
      <el-table-column prop="item_code" label="二维码编码" min-width="140" />
      <el-table-column prop="spare_name" label="名称" min-width="140" />
      <el-table-column prop="model" label="型号" min-width="120" />
      <el-table-column prop="category_name" label="分类" width="110" />
      <el-table-column prop="warehouse_name" label="仓库" width="100" />
      <el-table-column prop="location_name" label="货位" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="{row}">
          <el-tag :type="STATUS_META[row.status]?.tag || ''">{{ STATUS_META[row.status]?.label || row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="220" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="printOne(row)"><el-icon><Printer /></el-icon> 打印</el-button>
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 批量生成 -->
    <el-dialog v-model="batchVisible" title="批量生成备件实例（二维码）" width="620px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.spare_name" placeholder="如 断路器" /></el-form-item>
        <el-form-item label="型号"><el-input v-model="form.model" placeholder="如 DZ47-63（选填）" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category_id" placeholder="请选择" style="width:100%">
            <el-option v-for="c in categories" :key="c.category_id" :label="c.category_name" :value="c.category_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouse_id" placeholder="请选择" style="width:100%" @change="onWarehouseChange">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架">
          <el-select v-model="form.shelf_id" placeholder="请先选择仓库" style="width:100%" @change="onShelfChange">
            <el-option v-for="s in filteredShelves" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货位">
          <el-select v-model="form.storage_location_id" placeholder="请先选择货架" style="width:100%">
            <el-option v-for="l in filteredLocations" :key="l.location_id" :label="`${l.location_code} - ${l.location_name}`" :value="l.location_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="单位"><el-input v-model="form.unit" placeholder="如 件" /></el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="form.count" :min="1" :max="500" />
        </el-form-item>
        <el-form-item label="默认状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="在库" value="available" />
            <el-option label="借出" value="borrowed" />
            <el-option label="维修" value="maintenance" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible=false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="handleGenerate">生成并准备打印</el-button>
      </template>
    </el-dialog>

    <!-- 编辑 -->
    <el-dialog v-model="editVisible" title="编辑备件实例" width="560px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="名称"><el-input v-model="editForm.spare_name" /></el-form-item>
        <el-form-item label="型号"><el-input v-model="editForm.model" /></el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="editForm.warehouse_id" placeholder="请选择" style="width:100%" @change="onEditWarehouseChange">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架">
          <el-select v-model="editForm.shelf_id" placeholder="请先选择仓库" style="width:100%" @change="onEditShelfChange">
            <el-option v-for="s in editFilteredShelves" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货位">
          <el-select v-model="editForm.storage_location_id" placeholder="请先选择货架" style="width:100%">
            <el-option v-for="l in editFilteredLocations" :key="l.location_id" :label="`${l.location_code} - ${l.location_name}`" :value="l.location_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width:100%">
            <el-option label="在库" value="available" />
            <el-option label="借出" value="borrowed" />
            <el-option label="维修" value="maintenance" />
            <el-option label="报废" value="scrap" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible=false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Printer, Refresh } from '@element-plus/icons-vue'
import { getSpareItems, createSpareItemsBatch, updateSpareItem, deleteSpareItem, getMaterialCategories, getWarehouses, getShelves, getStorageLocations } from '@/api'

const STATUS_META: Record<string, { label: string; tag: string }> = {
  available: { label: '在库', tag: 'success' },
  borrowed: { label: '借出', tag: 'warning' },
  maintenance: { label: '维修', tag: 'info' },
  scrap: { label: '报废', tag: 'danger' }
}

const list = ref<any[]>([])
const categories = ref<any[]>([])
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const keyword = ref('')
const statusFilter = ref('')
const warehouseFilter = ref<any>(null)
const batchVisible = ref(false)
const generating = ref(false)
const editVisible = ref(false)
const saving = ref(false)
const editForm = ref<any>({})
const form = ref<any>({ spare_name: '', model: '', category_id: undefined, warehouse_id: undefined, shelf_id: undefined, storage_location_id: undefined, unit: '件', count: 1, status: 'available' })

const filteredList = computed(() => list.value.filter(t => {
  if (statusFilter.value && t.status !== statusFilter.value) return false
  if (warehouseFilter.value && t.warehouse_id !== warehouseFilter.value) return false
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    if (!String(t.spare_name || '').toLowerCase().includes(kw) && !String(t.item_code || '').toLowerCase().includes(kw) && !String(t.model || '').toLowerCase().includes(kw)) return false
  }
  return true
}))

const filteredShelves = computed(() => !form.value.warehouse_id ? [] : shelves.value.filter(s => s.warehouse_id === form.value.warehouse_id))
const filteredLocations = computed(() => !form.value.shelf_id ? [] : locations.value.filter(l => l.shelf_id === form.value.shelf_id))
const editFilteredShelves = computed(() => !editForm.value.warehouse_id ? [] : shelves.value.filter(s => s.warehouse_id === editForm.value.warehouse_id))
const editFilteredLocations = computed(() => !editForm.value.shelf_id ? [] : locations.value.filter(l => l.shelf_id === editForm.value.shelf_id))

const onWarehouseChange = () => { form.value.shelf_id = undefined; form.value.storage_location_id = undefined }
const onShelfChange = () => { form.value.storage_location_id = undefined }
const onEditWarehouseChange = () => { editForm.value.shelf_id = undefined; editForm.value.storage_location_id = undefined }
const onEditShelfChange = () => { editForm.value.storage_location_id = undefined }

const load = async () => { list.value = await getSpareItems() }
const loadCategories = async () => { categories.value = await getMaterialCategories({ category_type: 'spare' }) }
const loadWarehouses = async () => { warehouses.value = await getWarehouses() }
const loadShelves = async () => { shelves.value = await getShelves() }
const loadLocations = async () => { locations.value = await getStorageLocations() }

const openBatchDialog = () => {
  form.value = { spare_name: '', model: '', category_id: undefined, warehouse_id: undefined, shelf_id: undefined, storage_location_id: undefined, unit: '件', count: 1, status: 'available' }
  batchVisible.value = true
}
const handleGenerate = async () => {
  if (!form.value.spare_name) { ElMessage.warning('请填写名称'); return }
  if (!form.value.warehouse_id) { ElMessage.warning('请选择仓库'); return }
  generating.value = true
  try {
    const res: any = await createSpareItemsBatch({ ...form.value })
    ElMessage.success(res.message || '生成成功')
    batchVisible.value = false
    await load()
    // 生成后立即进入批量打印（连续打印这批新生成的二维码）
    batchPrintList(res.items || [])
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '生成失败') } finally { generating.value = false }
}

const batchPrintList = async (items: any[]) => {
  if (!items.length) { ElMessage.warning('没有可打印的标签'); return }
  const QRCode = (await import('qrcode')).default
  const labels: string[] = []
  for (const it of items) {
    const dataUrl = await QRCode.toDataURL(it.item_code, { width: 240, margin: 1 })
    labels.push(`
      <div class="label">
        <div class="name">${it.spare_name}</div>
        <img src="${dataUrl}" style="width:200px;height:200px" />
        <div class="code">${it.item_code}</div>
        <div class="loc">${it.warehouse_name || ''} ${it.location_name || ''}</div>
      </div>`)
  }
  printHtml('备件二维码批量打印', labels)
}

const batchPrint = async () => {
  if (!filteredList.value.length) { ElMessage.warning('没有可打印的记录'); return }
  await batchPrintList(filteredList.value)
}

const printOne = async (row: any) => { await batchPrintList([row]) }

function printHtml(title: string, labels: string[]) {
  const win = window.open('', '_blank', 'width=420,height=320')
  if (!win) { ElMessage.warning('弹窗被拦截，请允许弹窗后重试'); return }
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{margin:0;font-family:sans-serif}
      .label{width:48mm;min-height:30mm;border:1px solid #333;padding:8px;margin:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}
      .name{font-size:13px;font-weight:bold;margin-bottom:4px}
      .code{font-size:12px;margin-top:4px;letter-spacing:1px}
      .loc{font-size:11px;color:#555;margin-top:2px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <div class="noprint" style="padding:8px"><button onclick="window.print()">打印</button></div>
    ${labels.join('\n')}
    </body></html>`)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

const openEdit = (row: any) => { editForm.value = { ...row, warehouse_id: row.warehouse_id, shelf_id: row.shelf_id, storage_location_id: row.storage_location_id, status: row.status }; editVisible.value = true }
const handleSaveEdit = async () => {
  saving.value = true
  try {
    await updateSpareItem(editForm.value.item_id, {
      spare_name: editForm.value.spare_name, model: editForm.value.model,
      warehouse_id: editForm.value.warehouse_id, shelf_id: editForm.value.shelf_id,
      storage_location_id: editForm.value.storage_location_id, status: editForm.value.status
    })
    ElMessage.success('保存成功'); editVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') } finally { saving.value = false }
}

const handleDelete = async (row: any) => {
  await ElMessageBox.confirm(`确定删除实例 ${row.item_code}？`, '提示', { type: 'warning' })
  try { await deleteSpareItem(row.item_id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}

onMounted(() => { load(); loadCategories(); loadWarehouses(); loadShelves(); loadLocations() })
</script>

<style scoped>
:deep(.el-table .cell) { white-space: nowrap; }
</style>
