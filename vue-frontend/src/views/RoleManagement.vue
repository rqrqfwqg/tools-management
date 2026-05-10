<template>
  <div>
    <h2>角色管理</h2>
    <el-button type="primary" @click="openDialog()">新增角色</el-button>
    <el-table :data="list" style="margin-top:15px">
      <el-table-column prop="role_id" label="ID" width="60" />
      <el-table-column prop="role_name" label="角色名称" />
      <el-table-column prop="role_code" label="角色编码" width="120" />
      <el-table-column prop="description" label="描述" />
      <el-table-column prop="user_count" label="用户数" width="80" />
      <el-table-column label="操作" width="180">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)" :disabled="row.is_system">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.role_id)" :disabled="row.is_system || row.user_count > 0">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="form.role_id ? '编辑角色' : '新增角色'">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.role_name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.role_code" :disabled="form.is_system" /></el-form-item>
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
import { ref, onMounted } from 'vue'
import { getRoles, createRole, updateRole, deleteRole } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const load = async () => { list.value = await getRoles() }
const openDialog = (row?: any) => { form.value = row ? { ...row } : { role_code:'', role_name:'', description:'' }; dialogVisible.value = true }
const handleSave = async () => {
  try {
    form.value.role_id ? await updateRole(form.value.role_id, form.value) : await createRole(form.value)
    ElMessage.success('保存成功'); dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？','提示',{type:'warning'})
  try { await deleteRole(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}
onMounted(load)
</script>
