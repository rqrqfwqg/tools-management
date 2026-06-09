<template>
  <div>
    <h2>部门管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增部门</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column prop="dept_id" label="ID" width="60" />
      <el-table-column prop="dept_name" label="部门名称" show-overflow-tooltip />
      <el-table-column prop="dept_code" label="部门编码" min-width="100" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="操作" min-width="160">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.dept_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="form.dept_id ? '编辑部门' : '新增部门'">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.dept_name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.dept_code" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
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
import { getDepts, createDept, updateDept, deleteDept } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const keyword = ref('')
const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const kw = keyword.value.toLowerCase()
  return list.value.filter(d => d.dept_name?.toLowerCase().includes(kw) || d.dept_code?.toLowerCase().includes(kw))
})
const load = async () => { list.value = await getDepts() }
const openDialog = (row?: any) => { form.value = row ? { ...row } : {}; dialogVisible.value = true }
const handleSave = async () => {
  try {
    form.value.dept_id ? await updateDept(form.value.dept_id, form.value) : await createDept(form.value)
    ElMessage.success('保存成功'); dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？','提示',{type:'warning'})
  try { await deleteDept(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}
onMounted(load)
</script>
