<template>
  <div>
    <h2>仓库管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增仓库</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
      <el-select v-model="restrictedFilter" placeholder="全部区域" clearable style="width:120px">
        <el-option label="隔离区内" value="yes" />
        <el-option label="隔离区外" value="no" />
      </el-select>
      <el-select v-model="activeFilter" placeholder="全部状态" clearable style="width:120px">
        <el-option label="启用" value="yes" />
        <el-option label="停用" value="no" />
      </el-select>
    </div>
    <el-table :data="filteredList" style="margin-top:0">
      <el-table-column prop="warehouse_id" label="ID" width="60" />
      <el-table-column prop="warehouse_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="warehouse_name" label="名称" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="隔离区" width="100">
        <template #default="{row}">
          <el-tag :type="row.is_restricted !== false ? 'danger' : 'success'" size="small">
            {{ row.is_restricted !== false ? '隔离区内' : '隔离区外' }}
          </el-tag>
        </template>
      </el-table-column>
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
          <el-button size="small" type="danger" @click="handleDelete(row.warehouse_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="form.warehouse_id ? '编辑仓库' : '新增仓库'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="仓库编码"><el-input v-model="form.warehouse_code" /></el-form-item>
        <el-form-item label="仓库名称"><el-input v-model="form.warehouse_name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="隔离区">
          <el-switch v-model="form.is_restricted" active-text="隔离区内" inactive-text="隔离区外" />
          <div style="color:#909399;font-size:12px;margin-top:4px">隔离区外的仓库领用工器具无需审批</div>
        </el-form-item>
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
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const keyword = ref('')
const restrictedFilter = ref('')
const activeFilter = ref('')

const filteredList = computed(() => {
  return list.value.filter(w => {
    if (restrictedFilter.value === 'yes' && w.is_restricted === false) return false
    if (restrictedFilter.value === 'no' && w.is_restricted !== false) return false
    if (activeFilter.value === 'yes' && !w.is_active) return false
    if (activeFilter.value === 'no' && w.is_active) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!w.warehouse_name?.toLowerCase().includes(kw) && !w.warehouse_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

const load = async () => {
  list.value = await getWarehouses()
}

const openDialog = (row?: any) => {
  form.value = row ? { ...row } : { is_active: true, description: '', is_restricted: true }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.warehouse_id) {
      await updateWarehouse(form.value.warehouse_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createWarehouse(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该仓库？', '提示', { type: 'warning' })
  try {
    await deleteWarehouse(id)
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>
