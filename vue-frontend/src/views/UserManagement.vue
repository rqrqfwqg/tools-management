<template>
  <div>
    <h2>用户管理</h2>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <el-button type="primary" @click="openDialog()">新增用户</el-button>
      <el-input v-model="keyword" placeholder="搜索姓名/用户名/手机" clearable prefix-icon="Search" style="width:200px" />
      <el-select v-model="deptFilter" placeholder="全部部门" clearable style="width:120px">
        <el-option v-for="d in depts" :key="d.dept_id" :label="d.dept_name" :value="d.dept_name" />
      </el-select>
      <el-select v-model="roleFilter" placeholder="全部角色" clearable style="width:120px">
        <el-option v-for="r in allRoles" :key="r.role_id" :label="r.role_name" :value="r.role_code" />
      </el-select>
      <el-select v-model="activeFilter" placeholder="全部状态" clearable style="width:100px">
        <el-option label="启用" value="yes" />
        <el-option label="停用" value="no" />
      </el-select>
    </div>
    <el-table :data="filteredList" border style="margin-top:0">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="username" label="用户名" show-overflow-tooltip />
      <el-table-column prop="real_name" label="姓名" show-overflow-tooltip />
      <el-table-column prop="dept_name" label="部门" show-overflow-tooltip />
      <el-table-column prop="role_name" label="角色" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机" min-width="110" />
      <el-table-column prop="is_active" label="状态" width="80">
        <template #default="{row}">
          <el-tag :type="row.is_active ? 'success' : 'danger'">{{ row.is_active ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="260" fixed="right">
        <template #default="{row}">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="warning" @click="handleResetPassword(row)">重置密码</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.user_id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.user_id ? '编辑用户' : '新增用户'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="!!form.user_id" />
        </el-form-item>
        <el-form-item label="密码" v-if="!form.user_id">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.dept_id" placeholder="请选择部门" style="width:100%">
            <el-option
              v-for="d in depts"
              :key="d.dept_id"
              :label="d.dept_name"
              :value="d.dept_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" placeholder="请选择角色" style="width:100%">
            <el-option v-for="r in allRoles" :key="r.role_id" :label="r.role_name" :value="r.role_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="form.is_active"
            :active-value="true"
            :inactive-value="false"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUsers, createUser, updateUser, deleteUser, resetPassword, getDepts, getRoles } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { User } from '@/types'

const users = ref<User[]>([])
const allRoles = ref<any[]>([])
const depts = ref<any[]>([])
const dialogVisible = ref(false)
const form = ref<any>({ is_active: true, role: 'staff' })
const keyword = ref('')
const deptFilter = ref('')
const roleFilter = ref('')
const activeFilter = ref('')

const filteredList = computed(() => {
  return users.value.filter(u => {
    if (deptFilter.value && u.dept_name !== deptFilter.value) return false
    if (roleFilter.value && u.role !== roleFilter.value) return false
    if (activeFilter.value === 'yes' && !u.is_active) return false
    if (activeFilter.value === 'no' && u.is_active) return false
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!u.real_name?.toLowerCase().includes(kw) && !u.username?.toLowerCase().includes(kw) && !u.phone?.includes(kw)) return false
    }
    return true
  })
})

const load = async () => { users.value = await getUsers() }
const loadRoles = async () => { allRoles.value = await getRoles() }
const loadDepts = async () => {
  depts.value = await getDepts()
  // 用户列表里补充 dept_name
  users.value.forEach(u => {
    const d = depts.value.find(d => d.dept_id === u.dept_id)
    u.dept_name = d ? d.dept_name : `ID:${u.dept_id}`
  })
}

const openDialog = (row?: User) => {
  form.value = row
    ? { ...row, password: '' }
    : { username: '', real_name: '', password: '123456', dept_id: depts.value[0]?.dept_id || 1, role: 'staff', is_active: true, phone: '' }
  dialogVisible.value = true
}

const handleSave = async () => {
  try {
    if (form.value.user_id) {
      await updateUser(form.value.user_id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createUser(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
    loadDepts()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该用户？', '提示', { type: 'warning' })
  try {
    await deleteUser(id)
    ElMessage.success('删除成功')
    load()
    loadDepts()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

const handleResetPassword = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确定将用户 "${row.real_name || row.username}" 的密码重置为 123456？`,
      '重置密码',
      { type: 'warning', confirmButtonText: '确定重置', cancelButtonText: '取消' }
    )
    await resetPassword(row.user_id, '123456')
    ElMessage.success('密码已重置为 123456')
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.message || '密码重置失败')
    }
  }
}

onMounted(() => { load(); loadRoles(); loadDepts() })
</script>
