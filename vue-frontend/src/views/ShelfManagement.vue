<template>
  <div>
    <h2>货架管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增货架</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="warehouseFilter" placeholder="全部仓库" clearable style="width:120px">
        <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
      </el-select>
      <el-select v-model="activeFilter" placeholder="全部状态" clearable style="width:100px">
        <el-option label="启用" value="yes" />
        <el-option label="停用" value="no" />
      </el-select>
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="shelf_code" label="编码" min-width="80" show-overflow-tooltip />
      <el-table-column prop="shelf_name" label="名称" show-overflow-tooltip />
      <el-table-column label="所属仓库" min-width="120" show-overflow-tooltip>
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
          <el-button size="small" type="danger" @click="handleDelete(row.shelf_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="form.shelf_id ? '编辑货架' : '新增货架'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="所属仓库">
          <el-select v-model="form.warehouse_id" placeholder="请选择仓库" style="width:100%">
            <el-option v-for="w in warehouses" :key="w.warehouse_id" :label="w.warehouse_name" :value="w.warehouse_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="货架编码"><el-input v-model="form.shelf_code" /></el-form-item>
        <el-form-item label="货架名称"><el-input v-model="form.shelf_name" /></el-form-item>
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
import { getShelves, createShelf, updateShelf, deleteShelf, getWarehouses } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const warehouses = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const keyword = ref('')
const warehouseFilter = ref('')
const activeFilter = ref('')

const filteredList = computed(() => {
  return list.value.filter(s => {
    if (warehouseFilter.value && s.warehouse_id !== warehouseFilter.value) return false
    if (activeFilter.value === 'yes' && !s.is_active) return false
    if (activeFilter.value === 'no' && s.is_active) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!s.shelf_name?.toLowerCase().includes(kw) && !s.shelf_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

const load = async () => {
  list.value = await getShelves()
  warehouses.value = await getWarehouses()
}

const getWarehouseName = (id: number) => {
  const w = warehouses.value.find(w => w.warehouse_id === id)
  return w?.warehouse_name || '-'
}

const openDialog = (row?: any) => {
  form.value = row ? { ...row } : { is_active: true, description: '', warehouse_id: undefined }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.shelf_id) {
      await updateShelf(form.value.shelf_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createShelf(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该货架？', '提示', { type: 'warning' })
  try {
    await deleteShelf(id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>
