<template>
  <div>
    <h2>货位管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增货位</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:120px">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
      </el-select>
      <el-select v-model="shelfFilter" placeholder="全部货架" clearable style="width:120px">
        <el-option v-for="s in filteredShelfOptions" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
      </el-select>
      <el-select v-model="activeFilter" placeholder="全部状态" clearable style="width:100px">
        <el-option label="启用" value="yes" />
        <el-option label="停用" value="no" />
      </el-select>
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column prop="location_id" label="ID" width="60" />
      <el-table-column prop="location_code" label="编码" min-width="80" show-overflow-tooltip />
      <el-table-column prop="location_name" label="名称" show-overflow-tooltip />
      <el-table-column label="所属货架" min-width="100" show-overflow-tooltip>
        <template #default="{row}">
          {{ getShelfName(row.shelf_id) }}
        </template>
      </el-table-column>
      <el-table-column label="所属仓库" min-width="100" show-overflow-tooltip>
        <template #default="{row}">
          {{ getWarehouseName(row.warehouse_id) }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="状态" width="80">
        <template #default="{row}">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="160">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.location_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="form.location_id ? '编辑货位' : '新增货位'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="所属仓库">
          <el-select v-model="form.warehouse_id" placeholder="请选择仓库" style="width:100%" @change="onWarehouseChange">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属货架">
          <el-select v-model="form.shelf_id" placeholder="请先选择仓库" style="width:100%">
            <el-option v-for="s in filteredShelves" :key="s.shelf_id" :label="s.shelf_name" :value="s.shelf_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货位编码"><el-input v-model="form.location_code" /></el-form-item>
        <el-form-item label="货位名称"><el-input v-model="form.location_name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getStorageLocations, createStorageLocation, updateStorageLocation, deleteStorageLocation, getWarehouses, getShelves } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const warehouses = ref<any[]>([])
const shelves = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const keyword = ref('')
const warehouseFilter = ref('')
const shelfFilter = ref('')
const activeFilter = ref('')

// 筛选栏：货架选项跟随仓库联动
const filteredShelfOptions = computed(() => {
  if (!warehouseFilter.value) return shelves.value
  return shelves.value.filter(s => s.warehouse_id === warehouseFilter.value)
})

// 筛选后的列表
const filteredList = computed(() => {
  return list.value.filter(l => {
    if (warehouseFilter.value && l.warehouse_id !== warehouseFilter.value) return false
    if (shelfFilter.value && l.shelf_id !== shelfFilter.value) return false
    if (activeFilter.value === 'yes' && !l.is_active) return false
    if (activeFilter.value === 'no' && l.is_active) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!l.location_name?.toLowerCase().includes(kw) && !l.location_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

const load = async () => {
  list.value = await getStorageLocations()
  warehouses.value = await getWarehouses()
  shelves.value = await getShelves()
}

const getWarehouseName = (id: number) => {
  const w = warehouses.value.find(w => w.warehouse_id === id)
  return w?.warehouse_name || '-'
}

const getShelfName = (id: number) => {
  const s = shelves.value.find(s => s.shelf_id === id)
  return s?.shelf_name || '-'
}

const filteredShelves = computed(() => {
  if (!form.value.warehouse_id) return []
  return shelves.value.filter(s => s.warehouse_id === form.value.warehouse_id)
})

const onWarehouseChange = () => {
  form.value.shelf_id = undefined
}

const openDialog = (row?: any) => {
  form.value = row ? { ...row } : { is_active: true, description: '', warehouse_id: undefined, shelf_id: undefined }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.location_id) {
      await updateStorageLocation(form.value.location_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createStorageLocation(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该货位？', '提示', { type: 'warning' })
  try {
    await deleteStorageLocation(id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>
