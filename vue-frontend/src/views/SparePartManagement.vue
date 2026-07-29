<template>
  <div>
    <h2>备件管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增备件</el-button>
      <el-button type="success" @click="exportExcel"><el-icon style="margin-right:4px"><Download /></el-icon>导出Excel</el-button>
      <el-button @click="goBarcodeList"><el-icon style="margin-right:4px"><Printer /></el-icon>条形码清单</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:120px">
        <el-option label="可用" value="available" />
        <el-option label="预留" value="reserved" />
        <el-option label="借出" value="borrowed" />
        <el-option label="维修" value="maintenance" />
      </el-select>
      <el-select v-model="categoryFilter" placeholder="全部分类" clearable style="width:120px">
        <el-option v-for="c in categories" :key="c.category_id" :label="c.category_name" :value="c.category_name" />
      </el-select>
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:120px" @change="onWarehouseFilterChange">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_name" />
      </el-select>
      <el-select v-model="shelfFilter" placeholder="全部货架" clearable style="width:120px" @change="onShelfFilterChange">
        <el-option v-for="s in shelfFilterOptions" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_name" />
      </el-select>
      <el-select v-model="locationFilter" placeholder="全部货位" clearable style="width:140px">
        <el-option v-for="l in locationFilterOptions" :key="l.location_id" :label="l.location_name || l.location_code" :value="l.location_name || l.location_code" />
      </el-select>
    </div>
    <el-table :data="filteredList" border style="margin-top:0" :row-class-name="lowStockRowClass">
      <el-table-column label="图片" width="80">
        <template #default="{row}">
          <el-image v-if="row.image_url" :src="getImageUrl(row.image_url)" fit="cover" style="width:50px;height:50px;border-radius:4px" :preview-src-list="[getImageUrl(row.image_url)]" preview-teleported />
          <div v-else style="width:50px;height:50px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px"><el-icon><Picture /></el-icon></div>
        </template>
      </el-table-column>
      <el-table-column prop="spare_id" label="ID" width="60" />
      <el-table-column prop="spare_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="spare_name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="category_name" label="分类" min-width="80" show-overflow-tooltip />
      <el-table-column prop="model" label="型号" min-width="100" show-overflow-tooltip />
      <el-table-column label="最低库存" min-width="110">
        <template #default="{row}">
          <span>{{ row.warning_qty != null ? row.warning_qty : '-' }}</span>
          <el-tag v-if="row.is_low_stock" type="warning" size="small" style="margin-left:6px">库存预警</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{row}"><el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="warehouse_name" label="仓库" min-width="80" show-overflow-tooltip />
      <el-table-column prop="location_name" label="货位" min-width="80" show-overflow-tooltip />
      <el-table-column prop="borrow_count" label="借次" width="70" />
      <el-table-column label="操作" min-width="340" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" @click="openUploadDialog(row)" title="上传图片"><el-icon><Upload /></el-icon></el-button>
          <el-button size="small" @click="openBarcodeDialog(row)" title="生成条形码"><el-icon><Operation /></el-icon></el-button>
          <el-button size="small" type="primary" @click="handleAddToCart(row)" :disabled="row.status !== 'available'">加入领用篮</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.spare_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.spare_id ? '编辑备件' : '新增备件'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.spare_name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.spare_code" placeholder="如 BJ-001（可留空自动生成）" /></el-form-item>
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
        <el-form-item label="货位">
          <el-select v-model="form.storage_location_id" placeholder="请先选择货架" style="width:100%">
            <el-option v-for="l in filteredLocations" :key="l.location_id" :label="`${l.location_code} - ${l.location_name}`" :value="l.location_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号"><el-input v-model="form.model" placeholder="如 iPhone-13（同型号备件可设最低库存）" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="form.unit" placeholder="如 件" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="可用" value="available" />
            <el-option label="预留" value="reserved" />
            <el-option label="借出" value="borrowed" />
            <el-option label="维修" value="maintenance" />
          </el-select>
        </el-form-item>
        <el-form-item label="最低库存">
          <el-input-number v-model="form.warning_qty" :min="0" :controls="true" :precision="0" :value-on-clear="null" placeholder="留空表示不设" style="width:100%" />
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploadDialogVisible" title="上传备件图片" width="500px">
      <div v-if="currentSpare" style="text-align:center;margin-bottom:20px">
        <p style="margin-bottom:10px">当前备件：<strong>{{ currentSpare.spare_name }}</strong></p>
        <el-image v-if="currentSpare.image_url" :src="getImageUrl(currentSpare.image_url)" fit="cover" style="width:200px;height:200px;border-radius:8px;border:1px solid #eee" :preview-src-list="[getImageUrl(currentSpare.image_url)]" preview-teleported />
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

    <el-dialog v-model="barcodeDialogVisible" title="备件条形码" width="420px">
      <div v-if="barcodeSpare" style="text-align:center">
        <p style="margin-bottom:12px"><strong>{{ barcodeSpare.spare_name }}</strong><span style="color:#909399;margin-left:8px">{{ barcodeSpare.spare_code }}</span></p>
        <div style="background:#fff;border:1px solid #e0e0e0;padding:16px;border-radius:8px;display:flex;justify-content:center"><svg id="single-barcode"></svg></div>
        <p v-if="barcodeSpare.shelf_name || barcodeSpare.location_name" style="margin-top:8px;color:#909399;font-size:13px">{{ barcodeSpare.shelf_name }}{{ barcodeSpare.location_name ? ' ' + barcodeSpare.location_name : '' }}</p>
      </div>
      <template #footer>
        <el-button @click="barcodeDialogVisible=false">关闭</el-button>
        <el-button type="primary" @click="printBarcode">打印条形码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getSpareParts, createSparePart, updateSparePart, deleteSparePart, getMaterialCategories, getWarehouses, getShelves, getStorageLocations } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Picture, UploadFilled, Download, Printer, Operation } from '@element-plus/icons-vue'
import axios from 'axios'
import { useCartStore } from '@/store/cart'

const router = useRouter()
const list = ref<any[]>([])
const categories = ref<any[]>([])
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const dialogVisible = ref(false)
const uploadDialogVisible = ref(false)
const currentSpare = ref<any>(null)
const selectedFile = ref<File | null>(null)
const statusFilter = ref('')
const categoryFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const locationFilter = ref('')
const keyword = ref('')
const uploading = ref(false)
const uploadRef = ref()
const form = ref<any>({})

const filteredList = computed(() => list.value.filter(t => {
  if (statusFilter.value && t.status !== statusFilter.value) return false
  if (categoryFilter.value && t.category_name !== categoryFilter.value) return false
  if (warehouseFilter.value && t.warehouse_name !== warehouseFilter.value) return false
  if (shelfFilter.value) { const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value); if (s && t.shelf_id !== s.shelf_id) return false }
  if (locationFilter.value) { const l = locations.value.find(ll => (ll.location_name || ll.location_code) === locationFilter.value); if (l && t.storage_location_id !== l.location_id) return false }
  if (keyword.value) { const kw = keyword.value.toLowerCase(); if (!t.spare_name?.toLowerCase().includes(kw) && !t.spare_code?.toLowerCase().includes(kw)) return false }
  return true
}))

const getImageUrl = (path: string) => (!path ? '' : path.startsWith('http') ? path : `${path}`)
const filteredShelves = computed(() => !form.value.warehouse_id ? [] : shelves.value.filter(s => s.warehouse_id === form.value.warehouse_id))
const filteredLocations = computed(() => !form.value.shelf_id ? [] : locations.value.filter(l => l.shelf_id === form.value.shelf_id))
const shelfFilterOptions = computed(() => {
  if (!warehouseFilter.value) return shelves.value
  const w = warehouses.value.find(ww => ww.warehouse_name === warehouseFilter.value)
  return w ? shelves.value.filter(s => s.warehouse_id === w.warehouse_id) : shelves.value
})
const locationFilterOptions = computed(() => {
  if (!shelfFilter.value) return locations.value
  const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value)
  return s ? locations.value.filter(l => l.shelf_id === s.shelf_id) : locations.value
})
const onWarehouseFilterChange = () => { shelfFilter.value = ''; locationFilter.value = '' }
const onShelfFilterChange = () => { locationFilter.value = '' }
const onWarehouseChange = () => { form.value.shelf_id = undefined; form.value.storage_location_id = undefined }
const onShelfChange = () => { form.value.storage_location_id = undefined }

const load = async () => { list.value = await getSpareParts() }
const loadCategories = async () => { categories.value = await getMaterialCategories() }
const loadWarehouses = async () => { warehouses.value = await getWarehouses() }
const loadShelves = async () => { shelves.value = await getShelves() }
const loadLocations = async () => { locations.value = await getStorageLocations() }

const openDialog = (row?: any) => {
  if (row) form.value = { ...row }
  else form.value = { status: 'available', unit: '件', model: '', warehouse_id: undefined, shelf_id: undefined, storage_location_id: undefined, description: '' }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.spare_id) { await updateSparePart(form.value.spare_id, form.value); ElMessage.success('更新成功') }
    else { await createSparePart(form.value); ElMessage.success('创建成功') }
    dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该备件？', '提示', { type: 'warning' })
  try { await deleteSparePart(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}

const openUploadDialog = (row: any) => { currentSpare.value = row; selectedFile.value = null; uploadRef.value?.clearFiles(); uploadDialogVisible.value = true }
const beforeUpload = (file: File) => { if (file.size > 10 * 1024 * 1024) { ElMessage.error('文件过大，最大支持 10MB'); return false } return true }
const handleFileChange = (uploadFile: any) => { selectedFile.value = uploadFile.raw as File }
const handleFileRemove = () => { selectedFile.value = null }
const handleUpload = async () => {
  if (!selectedFile.value || !currentSpare.value) return
  uploading.value = true
  try {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    await axios.post(`/api/spare-parts/${currentSpare.value.spare_id}/upload-image`, formData, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('图片上传成功'); uploadDialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '上传失败') } finally { uploading.value = false }
}

const statusType = (s: string) => ({ available: 'success', reserved: 'info', borrowed: 'warning', maintenance: 'danger' }[s] || 'info')
const statusText = (s: string) => ({ available: '可用', reserved: '预留', borrowed: '借出', maintenance: '维修' }[s] || s)

// 低库存行高亮 class（按后端 is_low_stock 衍生字段）
const lowStockRowClass = ({ row }: any): string => (row.is_low_stock ? 'low-stock-row' : '')

const cartStore = useCartStore()
const handleAddToCart = (spare: any) => {
  cartStore.addToCart({ ...spare, item_type: 'spare', spare_id: spare.spare_id, spare_code: spare.spare_code, spare_name: spare.spare_name, tool_id: undefined, tool_code: undefined, tool_name: undefined })
  ElMessage.success(`已添加"${spare.spare_name}"到领用篮`)
}

const barcodeDialogVisible = ref(false)
const barcodeSpare = ref<any>(null)
let JsBarcodeMod: any = null
async function openBarcodeDialog(row: any) {
  barcodeSpare.value = row; barcodeDialogVisible.value = true; await nextTick()
  if (!JsBarcodeMod) { const mod = await import('jsbarcode'); JsBarcodeMod = mod.default || mod }
  const svgEl = document.getElementById('single-barcode')
  if (svgEl) { svgEl.innerHTML = ''; try { JsBarcodeMod(svgEl, row.spare_code, { format: 'CODE128', width: 2, height: 80, displayValue: true, fontSize: 16, margin: 10 }) } catch (e) { console.warn('条形码渲染失败', e) } }
}
function printBarcode() {
  const svgEl = document.getElementById('single-barcode')
  if (!svgEl || !barcodeSpare.value) return
  const svgHtml = svgEl.outerHTML
  const sp = barcodeSpare.value
  const win = window.open('', '_blank', 'width=420,height=320')
  if (!win) { ElMessage.warning('弹窗被拦截，请允许弹窗后重试'); return }
  win.document.write(`<!DOCTYPE html><html><head><title>条形码 - ${sp.spare_code}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif}.label{text-align:center;padding:16px}.label svg{max-width:100%}.name{font-size:14px;font-weight:bold;margin-bottom:6px}.loc{font-size:11px;color:#999;margin-top:4px}@page{size:auto;margin:5mm}</style></head><body><div class="label"><div class="name">${sp.spare_name}</div>${svgHtml}<div class="loc">${sp.shelf_name || ''} ${sp.location_name || ''}</div></div></body></html>`)
  win.document.close(); win.focus(); setTimeout(() => { win.print() }, 300)
}
function goBarcodeList() { router.push('/barcodes') }

async function exportExcel() {
  if (filteredList.value.length === 0) { ElMessage.warning('没有可导出的数据'); return }
  try {
    const XLSX = await import('xlsx')
    const data = filteredList.value.map((t: any, i: number) => ({
      '序号': i + 1, '编码': t.spare_code || '', '名称': t.spare_name || '', '分类': t.category_name || '',
      '仓库': t.warehouse_name || '', '货架': t.shelf_name || '', '货位': t.location_name || t.storage_location || '',
      '状态': statusText(t.status), '借出次数': t.borrow_count || 0
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '备件清单')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `备件清单_${date}.xlsx`)
    ElMessage.success(`已导出 ${data.length} 条记录`)
  } catch (e: any) { console.error('导出Excel失败', e); ElMessage.error('导出失败：' + (e.message || '未知错误')) }
}

onMounted(() => { load(); loadCategories(); loadWarehouses(); loadShelves(); loadLocations() })
</script>

<style scoped>
/* 低库存备件行：与消耗品预警风格一致的浅橙底色 */
:deep(.low-stock-row) td.el-table__cell {
  background-color: #fdf6ec !important;
}
</style>
