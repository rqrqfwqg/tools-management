<template>
  <div>
    <h2>工器具管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增工器具</el-button>
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
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:120px">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_name" />
      </el-select>
    </div>
    <el-table :data="filteredList" style="margin-top:0">
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
      <el-table-column prop="tool_code" label="编码" width="120" />
      <el-table-column prop="tool_name" label="名称" />
      <el-table-column prop="category_name" label="分类" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="{row}">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="warehouse" label="仓库" width="100" />
      <el-table-column prop="storage_location" label="货位" width="100" />
      <el-table-column prop="borrow_count" label="借次" width="70" />
      <el-table-column label="操作" width="300">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" @click="openUploadDialog(row)" title="上传图片">
            <el-icon><Upload /></el-icon>
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
        accept="image/*"
        drag
        style="text-align:center"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽图片到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 JPG/PNG/GIF，最大 5MB</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="uploadDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!selectedFile" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getTools, createTool, updateTool, deleteTool } from '@/api'
import { getCategories } from '@/api'
import { getWarehouses, getShelves, getStorageLocations } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Picture, UploadFilled, ShoppingCart } from '@element-plus/icons-vue'
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
const keyword = ref('')

// 筛选后的列表
const filteredList = computed(() => {
  return list.value.filter(t => {
    if (statusFilter.value && t.status !== statusFilter.value) return false
    if (categoryFilter.value && t.category_name !== categoryFilter.value) return false
    if (warehouseFilter.value && t.warehouse !== warehouseFilter.value) return false
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

onMounted(() => {
  load(); loadCategories(); loadWarehouses(); loadShelves(); loadLocations()
  // 从仪表盘跳转时自动筛选
  if (route.query.status) statusFilter.value = route.query.status as string
})
</script>
