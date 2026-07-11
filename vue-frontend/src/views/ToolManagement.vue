<template>
  <div>
    <h2>工器具管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增工器具</el-button>
      <el-button type="success" @click="exportExcel"><el-icon style="margin-right:4px"><Download /></el-icon>导出Excel</el-button>
      <el-button @click="goBarcodeList"><el-icon style="margin-right:4px"><Printer /></el-icon>条形码清单</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:120px">
        <el-option label="可用" value="available" />
        <el-option label="借出" value="borrowed" />
        <el-option label="维修" value="maintenance" />
        <el-option label="报废" value="scrapped" />
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
      <el-select v-model="toolkitFilter" placeholder="全部工具包" clearable style="width:140px">
        <el-option v-for="k in toolkits" :key="k.toolkit_id" :label="k.toolkit_name" :value="k.toolkit_name" />
      </el-select>
      <el-dropdown v-if="toolkitFilter" style="margin-left:4px">
        <el-button size="small" type="success">借一箱</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleBorrowKit(toolkitFilter)">领用"{{ toolkitFilter }}"全部可用工具</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column label="图片" width="80">
        <template #default="{row}">
          <el-image
            v-if="row.image_url"
            :src="getImageUrl(row.image_url)"
            fit="cover"
            style="width:50px;height:50px;border-radius:4px"
            :preview-src-list="[getImageUrl(row.image_url)]"
            preview-teleported
          />
          <div v-else style="width:50px;height:50px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px">
            <el-icon><Picture /></el-icon>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="tool_id" label="ID" width="60" />
      <el-table-column prop="tool_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="tool_name" label="名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="category_name" label="分类" min-width="80" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{row}">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="warehouse" label="仓库" min-width="80" show-overflow-tooltip />
      <el-table-column prop="storage_location" label="货位" min-width="80" show-overflow-tooltip />
      <el-table-column label="工具包" min-width="100">
        <template #default="{row}">
          <el-tag v-if="row.toolkit_name" type="success" size="small">{{ row.toolkit_name }}</el-tag>
          <span v-else style="color:#ccc">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="borrow_count" label="借次" width="70" />
      <el-table-column label="操作" min-width="340" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" @click="openUploadDialog(row)" title="上传图片">
            <el-icon><Upload /></el-icon>
          </el-button>
          <el-button size="small" @click="openBarcodeDialog(row)" title="生成条形码">
            <el-icon><Operation /></el-icon>
          </el-button>
          <el-button
            size="small"
            type="primary"
            @click="handleAddToCart(row)"
            :disabled="row.status !== 'available'"
          >
            加入购物车
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.tool_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="form.tool_id ? '编辑工器具' : '新增工器具'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.tool_name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.tool_code" /></el-form-item>
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
        <el-form-item label="使用场景"><el-input v-model="form.scene" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="可用" value="available" />
            <el-option label="借出" value="borrowed" />
            <el-option label="维修" value="maintenance" />
            <el-option label="报废" value="scrapped" />
          </el-select>
        </el-form-item>
        <el-form-item label="工具包">
          <el-select v-model="form.toolkit_name" placeholder="选择工具包（可选）" style="width:100%" clearable>
            <el-option v-for="k in toolkits" :key="k.toolkit_id" :label="k.toolkit_name" :value="k.toolkit_name" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 图片上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传工具图片" width="500px">
      <div v-if="currentTool" style="text-align:center;margin-bottom:20px">
        <p style="margin-bottom:10px">当前工具：<strong>{{ currentTool.tool_name }}</strong></p>
        <el-image
          v-if="currentTool.image_url"
          :src="getImageUrl(currentTool.image_url)"
          fit="cover"
          style="width:200px;height:200px;border-radius:8px;border:1px solid #eee"
          :preview-src-list="[getImageUrl(currentTool.image_url)]"
          preview-teleported
        />
        <div v-else style="width:200px;height:200px;background:#f5f5f5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#ccc;margin:0 auto">
          <el-icon style="font-size:48px"><Picture /></el-icon>
        </div>
      </div>
      <el-upload
        ref="uploadRef"
        :auto-upload="false"
        :limit="1"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :before-upload="beforeUpload"
        accept="image/*"
        drag
        style="text-align:center"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽图片到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 JPG/PNG/GIF/WebP，最大 10MB（自动压缩至 2MB 以内）</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="uploadDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!selectedFile" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>

    <!-- 条形码弹窗 -->
    <el-dialog v-model="barcodeDialogVisible" title="工具条形码" width="420px">
      <div v-if="barcodeTool" style="text-align:center">
        <p style="margin-bottom:12px">
          <strong>{{ barcodeTool.tool_name }}</strong>
          <span style="color:#909399;margin-left:8px">{{ barcodeTool.tool_code }}</span>
        </p>
        <div style="background:#fff;border:1px solid #e0e0e0;padding:16px;border-radius:8px;display:flex;justify-content:center">
          <svg id="single-barcode"></svg>
        </div>
        <p v-if="barcodeTool.shelf_name || barcodeTool.location_name" style="margin-top:8px;color:#909399;font-size:13px">
          {{ barcodeTool.shelf_name }}{{ barcodeTool.location_name ? ' ' + barcodeTool.location_name : '' }}
        </p>
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
import { useRoute, useRouter } from 'vue-router'
import { getTools, createTool, updateTool, deleteTool, getToolkits } from '@/api'
import { getCategories } from '@/api'
import { getWarehouses, getShelves, getStorageLocations } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Picture, UploadFilled, ShoppingCart, Download, Printer, Operation } from '@element-plus/icons-vue'
import axios from 'axios'
import { useCartStore } from '@/store/cart'

const route = useRoute()
const list = ref<any[]>([])
const categories = ref<any[]>([])
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const locations = ref<any[]>([])
const dialogVisible = ref(false)
const uploadDialogVisible = ref(false)
const currentTool = ref<any>(null)
const selectedFile = ref<File | null>(null)
const statusFilter = ref('')
const categoryFilter = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const locationFilter = ref('')
const toolkitFilter = ref('')
const toolkits = ref<any[]>([])
const keyword = ref('')

// 筛选后的列表
const filteredList = computed(() => {
  return list.value.filter(t => {
    if (statusFilter.value && t.status !== statusFilter.value) return false
    if (categoryFilter.value && t.category_name !== categoryFilter.value) return false
    if (warehouseFilter.value && t.warehouse !== warehouseFilter.value) return false
    if (shelfFilter.value) {
      const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value)
      if (s && t.shelf_id !== s.shelf_id) return false
    }
    if (locationFilter.value) {
      const l = locations.value.find(ll => (ll.location_name || ll.location_code) === locationFilter.value)
      if (l && t.storage_location_id !== l.location_id) return false
    }
    if (toolkitFilter.value && t.toolkit_name !== toolkitFilter.value) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!t.tool_name?.toLowerCase().includes(kw) && !t.tool_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})
const uploading = ref(false)
const uploadRef = ref()
const form = ref<any>({})

const BACKEND_BASE = ''

const getImageUrl = (path: string) => {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${BACKEND_BASE}${path}`
}

const filteredShelves = computed(() => {
  if (!form.value.warehouse_id) return []
  return shelves.value.filter(s => s.warehouse_id === form.value.warehouse_id)
})

const filteredLocations = computed(() => {
  if (!form.value.shelf_id) return []
  return locations.value.filter(l => l.shelf_id === form.value.shelf_id)
})

// 筛选下拉：货架按仓库过滤
const shelfFilterOptions = computed(() => {
  if (!warehouseFilter.value) return shelves.value
  const w = warehouses.value.find(ww => ww.warehouse_name === warehouseFilter.value)
  if (!w) return shelves.value
  return shelves.value.filter(s => s.warehouse_id === w.warehouse_id)
})

// 筛选下拉：货位按货架过滤
const locationFilterOptions = computed(() => {
  if (!shelfFilter.value) return locations.value
  const s = shelves.value.find(ss => ss.shelf_name === shelfFilter.value)
  if (!s) return locations.value
  return locations.value.filter(l => l.shelf_id === s.shelf_id)
})

const onWarehouseFilterChange = () => {
  shelfFilter.value = ''
  locationFilter.value = ''
}

const onShelfFilterChange = () => {
  locationFilter.value = ''
}

const onWarehouseChange = () => {
  form.value.shelf_id = undefined
  form.value.storage_location_id = undefined
}

const onShelfChange = () => {
  form.value.storage_location_id = undefined
}

const load = async () => { list.value = await getTools() }
const loadCategories = async () => { categories.value = await getCategories() }
const loadWarehouses = async () => { warehouses.value = await getWarehouses() }
const loadShelves = async () => { shelves.value = await getShelves() }
const loadLocations = async () => { locations.value = await getStorageLocations() }
const loadToolkits = async () => { toolkits.value = await getToolkits() }

// 借一箱：将工具包下所有可用工具加入购物车
const handleBorrowKit = (kitName: string) => {
  const kitTools = list.value.filter(t => t.toolkit_name === kitName && t.status === 'available')
  if (kitTools.length === 0) {
    ElMessage.warning(`工具包"${kitName}"中没有可用工具`)
    return
  }
  kitTools.forEach(t => cartStore.addToCart(t))
  ElMessage.success(`已将"${kitName}"中的 ${kitTools.length} 件工具加入购物车`)
}

const openDialog = (row?: any) => {
  if (row) {
    form.value = { ...row }
  } else {
    form.value = { status: 'available', scene: '', warehouse_id: undefined, shelf_id: undefined, storage_location_id: undefined, description: '' }
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.tool_id) {
      await updateTool(form.value.tool_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createTool(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该工器具？', '提示', { type: 'warning' })
  try {
    await deleteTool(id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

const openUploadDialog = (row: any) => {
  currentTool.value = row
  selectedFile.value = null
  uploadRef.value?.clearFiles()
  uploadDialogVisible.value = true
}

const beforeUpload = (file: File) => {
  const maxSize = 10 * 1024 * 1024  // 10MB
  if (file.size > maxSize) {
    ElMessage.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 10MB`)
    return false
  }
  return true
}

const handleFileChange = (uploadFile: any) => {
  selectedFile.value = uploadFile.raw as File
}

const handleFileRemove = () => {
  selectedFile.value = null
}

const handleUpload = async () => {
  if (!selectedFile.value || !currentTool.value) return
  uploading.value = true
  try {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    await axios.post(
      `${BACKEND_BASE}/api/tools/${currentTool.value.tool_id}/upload-image`,
      formData,
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
    )
    ElMessage.success('图片上传成功')
    uploadDialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const statusType = (s: string) => ({ available: 'success', borrowed: 'warning', maintenance: 'info', scrapped: 'danger' }[s] || 'info')
const statusText = (s: string) => ({ available: '可用', borrowed: '借出', maintenance: '维修', scrapped: '报废' }[s] || s)

const cartStore = useCartStore()
const handleAddToCart = (tool: any) => {
  cartStore.addToCart(tool)
  ElMessage.success(`已添加"${tool.tool_name}"到购物车`)
}

// ===== 条形码 =====
const router = useRouter()
const barcodeDialogVisible = ref(false)
const barcodeTool = ref<any>(null)
let JsBarcodeMod: any = null

async function openBarcodeDialog(row: any) {
  barcodeTool.value = row
  barcodeDialogVisible.value = true
  await nextTick()
  if (!JsBarcodeMod) {
    const mod = await import('jsbarcode')
    JsBarcodeMod = mod.default || mod
  }
  const svgEl = document.getElementById('single-barcode')
  if (svgEl) {
    svgEl.innerHTML = ''
    try {
      JsBarcodeMod(svgEl, row.tool_code, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 16,
        margin: 10
      })
    } catch (e) {
      console.warn('条形码渲染失败', e)
    }
  }
}

function printBarcode() {
  const svgEl = document.getElementById('single-barcode')
  if (!svgEl || !barcodeTool.value) return
  const svgHtml = svgEl.outerHTML
  const tool = barcodeTool.value
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) {
    ElMessage.warning('弹窗被拦截，请允许弹窗后重试')
    return
  }
  win.document.write(`<!DOCTYPE html><html><head><title>条形码 - ${tool.tool_code}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 40mm;
        min-height: 100vh;
        font-family: 'Microsoft YaHei', sans-serif;
      }
      .label {
        text-align: center;
        width: 120mm;
        border: 1px solid #ccc;
        padding: 10mm 8mm;
        border-radius: 4mm;
      }
      .name { font-size: 18px; font-weight: bold; margin-bottom: 6px; }
      .code { font-size: 15px; color: #333; margin-bottom: 8px; font-family: 'Courier New', monospace; }
      .label svg { max-width: 100%; height: auto; }
      .loc { font-size: 13px; color: #999; margin-top: 8px; }
    </style></head><body>
    <div class="label">
      <div class="name">${tool.tool_name}</div>
      <div class="code">${tool.tool_code}</div>
      ${svgHtml}
      <div class="loc">${tool.shelf_name || ''} ${tool.location_name || ''}</div>
    </div>
    </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 300)
}

function goBarcodeList() {
  router.push('/barcodes')
}

// ===== 导出 Excel =====
async function exportExcel() {
  if (filteredList.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }
  try {
    const XLSX = await import('xlsx')
    const data = filteredList.value.map((t: any, i: number) => ({
      '序号': i + 1,
      '编码': t.tool_code || '',
      '名称': t.tool_name || '',
      '分类': t.category_name || '',
      '仓库': t.warehouse || '',
      '货架': t.shelf_name || '',
      '货位': t.location_name || t.storage_location || '',
      '状态': statusText(t.status),
      '工具包': t.toolkit_name || '',
      '使用场景': t.scene || '',
      '借出次数': t.borrow_count || 0
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
      { wch: 12 }, { wch: 16 }, { wch: 10 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '工具清单')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `工具清单_${date}.xlsx`)
    ElMessage.success(`已导出 ${data.length} 条记录`)
  } catch (e: any) {
    console.error('导出Excel失败', e)
    ElMessage.error('导出失败：' + (e.message || '未知错误'))
  }
}

onMounted(() => {
  load(); loadCategories(); loadWarehouses(); loadShelves(); loadLocations(); loadToolkits()
  // 从仪表盘跳转时自动筛选
  if (route.query.status) statusFilter.value = route.query.status as string
})
</script>
