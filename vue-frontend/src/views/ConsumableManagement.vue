<template>
  <div>
    <h2>消耗品管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增消耗品</el-button>
      <el-button type="success" @click="exportExcel"><el-icon style="margin-right:4px"><Download /></el-icon>导出Excel</el-button>
      <el-button @click="goBarcodeList"><el-icon style="margin-right:4px"><Printer /></el-icon>条形码清单</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="categoryFilter" placeholder="全部分类" clearable style="width:140px">
        <el-option v-for="c in categories" :key="c.category_id" :label="c.category_name" :value="c.category_name" />
      </el-select>
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:140px" @change="onWarehouseFilterChange">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_name" />
      </el-select>
      <el-select v-model="shelfFilter" placeholder="全部货架" clearable style="width:140px" @change="onShelfFilterChange">
        <el-option v-for="s in shelfFilterOptions" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_name" />
      </el-select>
      <el-button type="warning" plain @click="openDirectTakeDialog">扫码直领</el-button>
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column label="图片" width="80">
        <template #default="{row}">
          <el-image v-if="row.image_url" :src="row.image_url" fit="cover" style="width:50px;height:50px;border-radius:4px" :preview-src-list="[row.image_url]" preview-teleported />
          <div v-else style="width:50px;height:50px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px"><el-icon><Picture /></el-icon></div>
        </template>
      </el-table-column>
      <el-table-column prop="consumable_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="consumable_name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="category_name" label="分类" min-width="80" show-overflow-tooltip />
      <el-table-column prop="warehouse_name" label="仓库" min-width="80" show-overflow-tooltip />
      <el-table-column prop="shelf_name" label="货架" min-width="80" show-overflow-tooltip />
      <el-table-column prop="location_name" label="库位" min-width="80" show-overflow-tooltip />
      <el-table-column prop="stock_qty" label="当前库存" width="100" />
      <el-table-column label="出库方式" width="110">
        <template #default="{row}">
          <el-tag :type="row.require_order ? 'warning' : 'success'" size="small">{{ row.require_order ? '需工单' : '免工单' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="预警值" width="90">
        <template #default="{row}">{{ row.warning_qty != null ? row.warning_qty : '-' }}</template>
      </el-table-column>
      <el-table-column label="库存状态" width="90">
        <template #default="{row}"><el-tag :type="STOCK_STATUS_META[stockStatus(row)].tag">{{ STOCK_STATUS_META[stockStatus(row)].label }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" min-width="280" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" @click="openUploadDialog(row)" title="上传图片"><el-icon><Upload /></el-icon></el-button>
          <el-button size="small" type="warning" plain @click="handleDirectTake(row)">扫码直领</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.consumable_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="form.consumable_id ? '编辑消耗品' : '新增消耗品'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.consumable_code" placeholder="如 XH-001（可留空自动生成）" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.consumable_name" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category_id" placeholder="请选择" style="width:100%">
            <el-option v-for="c in categories" :key="c.category_id" :label="c.category_name" :value="c.category_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouse_id" placeholder="请选择仓库" style="width:100%" @change="onWarehouseChange">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架">
          <el-select v-model="form.shelf_id" placeholder="请先选择仓库" style="width:100%" @change="onShelfChange">
            <el-option v-for="s in filteredShelves" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库位">
          <el-select v-model="form.storage_location_id" placeholder="请先选择货架" style="width:100%">
            <el-option v-for="l in filteredLocations" :key="l.location_id" :label="`${l.location_code} - ${l.location_name}`" :value="l.location_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前库存"><el-input-number v-model="form.stock_qty" :min="0" /></el-form-item>
        <el-form-item label="预警值"><el-input-number v-model="form.warning_qty" :min="0" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="form.unit" placeholder="如 个" /></el-form-item>
        <el-form-item label="出库方式">
          <el-switch v-model="form.require_order" active-text="需工单出库" inactive-text="免工单直领" />
        </el-form-item>
        <el-form-item label="规格"><el-input v-model="form.spec" placeholder="选填" /></el-form-item>
        <el-form-item label="型号"><el-input v-model="form.model" placeholder="选填" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 上传图片对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传消耗品图片" width="500px">
      <div v-if="currentItem" style="text-align:center;margin-bottom:20px">
        <p style="margin-bottom:10px">当前消耗品：<strong>{{ currentItem.consumable_name }}</strong></p>
        <el-image v-if="currentItem.image_url" :src="currentItem.image_url" fit="cover" style="width:200px;height:200px;border-radius:8px;border:1px solid #eee" :preview-src-list="[currentItem.image_url]" preview-teleported />
        <div v-else style="width:200px;height:200px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#ccc;margin:0 auto"><el-icon style="font-size:48px"><Picture /></el-icon></div>
      </div>
      <el-upload ref="uploadRef" :auto-upload="false" :limit="1" :on-change="handleFileChange" :on-remove="handleFileRemove" accept="image/*" drag style="text-align:center">
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽图片到此处，或 <em>点击上传</em></div>
        <template #tip><div class="el-upload__tip">支持 JPG/PNG/GIF/WebP，最大 10MB（自动压缩至 2MB 以内）</div></template>
      </el-upload>
      <template #footer>
        <el-button @click="uploadDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!selectedFile" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>

    <!-- 扫码直领：输入编码 -->
    <el-dialog v-model="takeCodeDialogVisible" title="扫码直领（消耗品）" width="420px">
      <el-alert type="info" :closable="false" style="margin-bottom:12px" title="请输入 XH- 开头的消耗品编码" />
      <el-input v-model="takeCode" placeholder="如 XH-001" @keyup.enter="handleTakeLookup" />
      <template #footer>
        <el-button @click="takeCodeDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="takeLookupLoading" @click="handleTakeLookup">查询</el-button>
      </template>
    </el-dialog>

    <!-- 扫码直领：数量输入 -->
    <el-dialog v-model="takeQtyDialogVisible" title="确认领用" width="420px">
      <div v-if="takeTarget" style="margin-bottom:16px">
        <p>名称：<strong>{{ takeTarget.consumable_name }}</strong></p>
        <p>编码：<span style="color:#909399">{{ takeTarget.consumable_code }}</span></p>
        <p>当前库存：<strong>{{ takeTarget.stock_qty }}</strong> {{ takeTarget.unit || '' }}</p>
      </div>
      <el-form label-width="80px">
        <el-form-item label="领用数量">
          <el-input-number v-model="takeQty" :min="1" :max="takeTarget ? takeTarget.stock_qty : 1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="takeQtyDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="takeSubmitting" @click="handleTakeSubmit">确认领用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getConsumables, createConsumable, updateConsumable, deleteConsumable,
  getConsumableByCode, takeConsumableByCode,
  getMaterialCategories, getWarehouses, getShelves, getStorageLocations
} from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Picture, UploadFilled, Download, Printer } from '@element-plus/icons-vue'
import axios from 'axios'
import { stockStatus, STOCK_STATUS_META } from '@/utils/stock'

const router = useRouter()
const list = ref<any[]>([])
const categories = ref<any[]>([])
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const dialogVisible = ref(false)
const uploadDialogVisible = ref(false)
const currentItem = ref<any>(null)
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadRef = ref()
const keyword = ref('')
const categoryFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const form = ref<any>({})

// 扫码直领
const takeCodeDialogVisible = ref(false)
const takeCode = ref('')
const takeLookupLoading = ref(false)
const takeTarget = ref<any>(null)
const takeQtyDialogVisible = ref(false)
const takeQty = ref(1)
const takeSubmitting = ref(false)

const filteredList = computed(() => list.value.filter(t => {
  if (categoryFilter.value && t.category_name !== categoryFilter.value) return false
  if (warehouseFilter.value && t.warehouse_name !== warehouseFilter.value) return false
  if (shelfFilter.value) { const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value); if (s && t.shelf_id !== s.shelf_id) return false }
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    if (!t.consumable_name?.toLowerCase().includes(kw) && !t.consumable_code?.toLowerCase().includes(kw)) return false
  }
  return true
}))

const filteredShelves = computed(() => !form.value.warehouse_id ? [] : shelves.value.filter(s => s.warehouse_id === form.value.warehouse_id))
const filteredLocations = computed(() => !form.value.shelf_id ? [] : locations.value.filter(l => l.shelf_id === form.value.shelf_id))
const shelfFilterOptions = computed(() => {
  if (!warehouseFilter.value) return shelves.value
  const w = warehouses.value.find(ww => ww.warehouse_name === warehouseFilter.value)
  return w ? shelves.value.filter(s => s.warehouse_id === w.warehouse_id) : shelves.value
})
const onWarehouseFilterChange = () => { shelfFilter.value = '' }
const onShelfFilterChange = () => {}
const onWarehouseChange = () => { form.value.shelf_id = undefined; form.value.storage_location_id = undefined }
const onShelfChange = () => { form.value.storage_location_id = undefined }

const load = async () => { list.value = await getConsumables() }
const loadCategories = async () => { categories.value = await getMaterialCategories({ category_type: 'consumable' }) }
const loadWarehouses = async () => { warehouses.value = await getWarehouses() }
const loadShelves = async () => { shelves.value = await getShelves() }
const loadLocations = async () => { locations.value = await getStorageLocations() }

const openDialog = (row?: any) => {
  if (row) form.value = { ...row }
  else form.value = { unit: '个', stock_qty: 0, warning_qty: null, require_order: false, warehouse_id: undefined, shelf_id: undefined, storage_location_id: undefined }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    const payload = { ...form.value }
    if (payload.consumable_id) { await updateConsumable(payload.consumable_id, payload); ElMessage.success('更新成功') }
    else { await createConsumable(payload); ElMessage.success('创建成功') }
    dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该消耗品？', '提示', { type: 'warning' })
  try { await deleteConsumable(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}

const openUploadDialog = (row: any) => { currentItem.value = row; selectedFile.value = null; uploadRef.value?.clearFiles(); uploadDialogVisible.value = true }
const handleFileChange = (uploadFile: any) => { selectedFile.value = uploadFile.raw as File }
const handleFileRemove = () => { selectedFile.value = null }
const handleUpload = async () => {
  if (!selectedFile.value || !currentItem.value) return
  uploading.value = true
  try {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    await axios.post(`/api/consumables/${currentItem.value.consumable_id}/upload-image`, formData, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('图片上传成功'); uploadDialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '上传失败') } finally { uploading.value = false }
}

// 扫码直领
const openDirectTakeDialog = () => {
  takeCode.value = ''; takeTarget.value = null
  takeCodeDialogVisible.value = true
}
const handleDirectTake = (row: any) => {
  takeCode.value = row.consumable_code || ''
  takeTarget.value = null
  takeCodeDialogVisible.value = true
  if (takeCode.value) handleTakeLookup()
}
const handleTakeLookup = async () => {
  const code = takeCode.value.trim()
  if (!code) { ElMessage.warning('请输入编码'); return }
  takeLookupLoading.value = true
  try {
    const res = await getConsumableByCode(code)
    takeTarget.value = res
    takeQty.value = 1
    takeCodeDialogVisible.value = false
    takeQtyDialogVisible.value = true
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '未找到该消耗品')
  } finally { takeLookupLoading.value = false }
}
const handleTakeSubmit = async () => {
  if (!takeTarget.value) return
  if (takeQty.value <= 0 || takeQty.value > takeTarget.value.stock_qty) {
    ElMessage.error(`领用数量需为 1 ~ ${takeTarget.value.stock_qty}`); return
  }
  takeSubmitting.value = true
  try {
    await takeConsumableByCode(takeTarget.value.consumable_code, takeQty.value)
    ElMessage.success('领用成功'); takeQtyDialogVisible.value = false; load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '领用失败')
  } finally { takeSubmitting.value = false }
}

function goBarcodeList() { router.push('/barcodes') }

async function exportExcel() {
  if (filteredList.value.length === 0) { ElMessage.warning('没有可导出的数据'); return }
  try {
    const XLSX = await import('xlsx')
    const data = filteredList.value.map((t: any, i: number) => ({
      '序号': i + 1, '编码': t.consumable_code || '', '名称': t.consumable_name || '', '分类': t.category_name || '',
      '仓库': t.warehouse_name || '', '货架': t.shelf_name || '', '库位': t.location_name || '',
      '当前库存': t.stock_qty || 0, '预警值': t.warning_qty != null ? t.warning_qty : '', '单位': t.unit || '',
      '库存状态': STOCK_STATUS_META[stockStatus(t)].label
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '消耗品清单')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `消耗品清单_${date}.xlsx`)
    ElMessage.success(`已导出 ${data.length} 条记录`)
  } catch (e: any) { console.error('导出Excel失败', e); ElMessage.error('导出失败：' + (e.message || '未知错误')) }
}

onMounted(() => { load(); loadCategories(); loadWarehouses(); loadShelves(); loadLocations() })
</script>
