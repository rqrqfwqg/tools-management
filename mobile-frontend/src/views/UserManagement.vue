<template>
  <div class="page-container">
    <van-nav-bar title="用户管理" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-search v-model="keyword" placeholder="搜索姓名/用户名/手机" shape="round" />

    <van-button type="primary" block round style="margin:10px 0" @click="openDialog()">新增用户</van-button>

    <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>

    <div v-for="u in filteredList" :key="u.user_id" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">{{ u.real_name }} <van-tag :type="u.role === 'admin' ? 'danger' : 'primary'">{{ u.role === 'admin' ? '管理员' : '员工' }}</van-tag></div>
          <div style="font-size:12px;color:#999">{{ u.username }} | {{ u.phone }}</div>
          <div style="font-size:12px;color:#999">{{ u.dept_name }}</div>
        </div>
        <div style="display:flex;gap:4px">
          <van-button size="small" @click="openDialog(u)">编辑</van-button>
          <van-button size="small" type="danger" @click="handleDelete(u)">删除</van-button>
        </div>
      </div>
    </div>

    <van-dialog v-model:show="dialogVisible" title="用户信息" show-cancel-button @confirm="handleSave">
      <van-field v-model="form.username" label="登录账号" required />
      <van-field v-model="form.real_name" label="真实姓名" required />
      <van-field v-model="form.phone" label="手机号" type="tel" />
      <van-field v-model="form.password" label="密码" placeholder="留空不修改" />
      <van-field name="dept_id" label="部门">
        <template #input>
          <van-picker :columns="deptColumns" @change="onDeptChange" />
        </template>
      </van-field>
      <van-field name="role" label="角色">
        <template #input>
          <van-radio-group v-model="form.role" direction="horizontal">
            <van-radio name="staff">员工</van-radio>
            <van-radio name="admin">管理员</van-radio>
          </van-radio-group>
        </template>
      </van-field>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getUsers, createUser, updateUser, deleteUser, getDepts } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const list = ref<any[]>([])
const depts = ref<any[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const form = ref<any>({ role: 'staff', is_active: true })

const deptColumns = computed(() => depts.value.map((d: any) => ({ text: d.dept_name, value: d.dept_id })))

const filteredList = computed(() => {
  return list.value.filter(u => {
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!u.real_name?.toLowerCase().includes(kw) && !u.username?.toLowerCase().includes(kw) && !u.phone?.includes(kw)) return false
    }
    return true
  })
})

function onDeptChange({ selectedValues }: any) {
  form.value.dept_id = selectedValues[0]
}

function openDialog(data?: any) {
  if (data) {
    form.value = { ...data, password: '' }
  } else {
    form.value = { username: '', real_name: '', phone: '', password: '123456', dept_id: depts.value[0]?.dept_id || 1, role: 'staff' }
  }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    const payload = { ...form.value }
    if (!payload.password) delete payload.password
    if (form.value.user_id) {
      await updateUser(form.value.user_id, payload)
    } else {
      await createUser(payload)
    }
    showToast('保存成功')
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    showToast(e.response?.data?.message || '保存失败')
  }
}

async function handleDelete(u: any) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除用户 "${u.real_name}" 吗？` })
    await deleteUser(u.user_id)
    showToast('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') showToast(e.response?.data?.message || '删除失败')
  }
}

async function load() {
  list.value = await getUsers()
  depts.value = await getDepts()
}

onMounted(load)
</script>
