<template>
  <div>
    <h2>物料分类管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增分类</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column prop="category_id" label="ID" width="60" />
      <el-table-column prop="category_name" label="分类名称" show-overflow-tooltip />
      <el-table-column prop="category_code" label="分类编码" min-width="100" show-overflow-tooltip />
      <el-table-column label="类型" width="110">
        <template #default="{row}"><el-tag :type="typeTag(row.category_type)">{{ typeText(row.category_type) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="description" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" min-width="160">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.category_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="form.category_id ? '编辑分类' : '新增分类'">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.category_name" /></el-form-item>
        <el-form-item label="编码"><el-input v-model="form.category_code" placeholder="如 SPARE / CONS / BOTH" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.category_type" placeholder="请选择" style="width:100%">
            <el-option label="备件" value="spare" />
            <el-option label="消耗品" value="consumable" />
            <el-option label="两者通用" value="both" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.description" type="textarea" /></el-form-item>
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
import { getMaterialCategories, createMaterialCategory, updateMaterialCategory, deleteMaterialCategory } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({})
const keyword = ref('')
const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const kw = keyword.value.toLowerCase()
  return list.value.filter(c => c.category_name?.toLowerCase().includes(kw) || c.category_code?.toLowerCase().includes(kw))
})
const typeTag = (t: string) => ({ spare: 'primary', consumable: 'success', both: 'warning' }[t] || 'info')
const typeText = (t: string) => ({ spare: '备件', consumable: '消耗品', both: '两者通用' }[t] || t)
const load = async () => { list.value = await getMaterialCategories() }
const openDialog = (row?: any) => { form.value = row ? { ...row } : { category_type: 'spare' }; dialogVisible.value = true }
const handleSave = async () => {
  try {
    form.value.category_id ? await updateMaterialCategory(form.value.category_id, form.value) : await createMaterialCategory(form.value)
    ElMessage.success('保存成功'); dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}
const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
  try { await deleteMaterialCategory(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}
onMounted(load)
</script>
