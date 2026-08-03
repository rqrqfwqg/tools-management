<template>
  <div>
    <h2>角色权限管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增角色</el-button>
      <el-input v-model="keyword" placeholder="搜索名称/编码" clearable prefix-icon="Search" style="width:180px" />
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="role_name" label="角色名称" min-width="100" show-overflow-tooltip />
      <el-table-column prop="role_code" label="编码" min-width="100" show-overflow-tooltip />
      <el-table-column label="审批工单" width="90" align="center">
        <template #default="{row}">
          <el-tag :type="row.permissions?.approve_orders ? 'success' : 'info'" size="small">{{ row.permissions?.approve_orders ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理工具" width="90" align="center">
        <template #default="{row}">
          <el-tag :type="row.permissions?.manage_tools ? 'success' : 'info'" size="small">{{ row.permissions?.manage_tools ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理仓库" width="90" align="center">
        <template #default="{row}">
          <el-tag :type="row.permissions?.manage_warehouses ? 'success' : 'info'" size="small">{{ row.permissions?.manage_warehouses ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理用户" width="90" align="center">
        <template #default="{row}">
          <el-tag :type="row.permissions?.manage_users ? 'success' : 'info'" size="small">{{ row.permissions?.manage_users ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理分类" width="90" align="center">
        <template #default="{row}">
          <el-tag :type="row.permissions?.manage_categories ? 'success' : 'info'" size="small">{{ row.permissions?.manage_categories ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="user_count" label="用户数" width="70" />
      <el-table-column label="操作" min-width="140" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.role_id)" :disabled="row.is_system || row.user_count > 0">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="角色权限配置" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="角色名称" required>
          <el-input v-model="form.role_name" placeholder="例：分队长" />
        </el-form-item>
        <el-form-item label="角色编码" required>
          <el-input v-model="form.role_code" :disabled="form.is_system" placeholder="例：team_leader" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" placeholder="可选描述" />
        </el-form-item>
        <el-divider content-position="left">系统权限</el-divider>
        <el-form-item label="审批工单">
          <el-switch v-model="form.permissions.approve_orders" />
          <span style="margin-left:8px;color:#999;font-size:12px">审核员工提交的工单申请</span>
        </el-form-item>
        <el-form-item label="管理工具">
          <el-switch v-model="form.permissions.manage_tools" />
          <span style="margin-left:8px;color:#999;font-size:12px">创建、编辑、删除工具</span>
        </el-form-item>
        <el-form-item label="管理仓库">
          <el-switch v-model="form.permissions.manage_warehouses" />
          <span style="margin-left:8px;color:#999;font-size:12px">管理仓库、货架、货位</span>
        </el-form-item>
        <el-form-item label="管理用户">
          <el-switch v-model="form.permissions.manage_users" />
          <span style="margin-left:8px;color:#999;font-size:12px">创建、编辑、删除用户和部门</span>
        </el-form-item>
        <el-form-item label="管理分类">
          <el-switch v-model="form.permissions.manage_categories" />
          <span style="margin-left:8px;color:#999;font-size:12px">管理工具分类/类型</span>
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
import { getRoles, createRole, updateRole, deleteRole } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const defaultPerms = () => ({ approve_orders: false, manage_tools: false, manage_warehouses: false, manage_users: false, manage_categories: false })

const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({ permissions: defaultPerms() })
const keyword = ref('')

const filteredList = computed(() => {
  if (!keyword.value) return list.value
  const kw = keyword.value.toLowerCase()
  return list.value.filter(r => r.role_name?.toLowerCase().includes(kw) || r.role_code?.toLowerCase().includes(kw))
})

const load = async () => { list.value = await getRoles() }

const openDialog = (row?: any) => {
  form.value = row ? { ...row, permissions: { ...defaultPerms(), ...(row.permissions || {}) } } : { role_code: '', role_name: '', description: '', permissions: defaultPerms() }
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.value.role_name?.trim()) { ElMessage.warning('请输入角色名称'); return }
  if (!form.value.role_code?.trim()) { ElMessage.warning('请输入角色编码'); return }
  const payload = { ...form.value }
  try {
    form.value.role_id ? await updateRole(form.value.role_id, payload) : await createRole(payload)
    ElMessage.success('保存成功'); dialogVisible.value = false; load()
  } catch (e: any) { ElMessage.error(e.response?.data?.message || '保存失败') }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该角色？', '提示', { type: 'warning' })
  try { await deleteRole(id); ElMessage.success('删除成功'); load() } catch (e: any) { ElMessage.error(e.response?.data?.message || '删除失败') }
}

onMounted(load)
</script>
