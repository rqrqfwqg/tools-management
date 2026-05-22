<template>
  <div class="page-container">
    <van-nav-bar title="仓库管理" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />
    <van-dropdown-menu>
      <van-dropdown-item v-model="restrictedFilter" :options="[{text:'全部区域',value:''},{text:'隔离区内',value:'yes'},{text:'隔离区外',value:'no'}]" />
      <van-dropdown-item v-model="activeFilter" :options="[{text:'全部状态',value:''},{text:'启用',value:'yes'},{text:'停用',value:'no'}]" />
    </van-dropdown-menu>

    <van-button type="primary" block round style="margin:10px 0" @click="openDialog()">新增仓库</van-button>

    <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>

    <div v-for="w in filteredList" :key="w.warehouse_id" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">{{ w.warehouse_name }}</div>
          <div style="font-size:12px;color:#999">{{ w.warehouse_code }}</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <van-tag :type="w.is_restricted !== false ? 'danger' : 'success'">
            {{ w.is_restricted !== false ? '隔离区' : '非隔离区' }}
          </van-tag>
          <van-tag :type="w.is_active ? 'success' : 'danger'">
            {{ w.is_active ? '启用' : '停用' }}
          </van-tag>
          <van-button size="small" @click="openDialog(w)">编辑</van-button>
          <van-button size="small" type="danger" @click="handleDelete(w)">删除</van-button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <van-dialog v-model:show="dialogVisible" title="仓库信息" show-cancel-button @confirm="handleSave">
      <van-field v-model="form.warehouse_name" label="仓库名称" required />
      <van-field v-model="form.warehouse_code" label="仓库编码" required />
      <van-field name="is_restricted" label="隔离区">
        <template #input>
          <van-switch v-model="form.is_restricted" active-text="是" inactive-text="否" />
        </template>
      </van-field>
      <van-field name="is_active" label="启用">
        <template #input>
          <van-switch v-model="form.is_active" active-text="是" inactive-text="否" />
        </template>
      </van-field>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const list = ref<any[]>([])
const keyword = ref('')
const restrictedFilter = ref('')
const activeFilter = ref('')
const dialogVisible = ref(false)
const form = ref<any>({ is_restricted: true, is_active: true })

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

function openDialog(data?: any) {
  if (data) {
    form.value = { ...data }
  } else {
    form.value = { warehouse_name: '', warehouse_code: '', is_restricted: true, is_active: true }
  }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    if (form.value.warehouse_id) {
      await updateWarehouse(form.value.warehouse_id, form.value)
    } else {
      await createWarehouse(form.value)
    }
    showToast('保存成功')
    dialogVisible.value = false
    await load()
  } catch (e: any) {
    showToast(e.response?.data?.message || '保存失败')
  }
}

async function handleDelete(w: any) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除仓库 "${w.warehouse_name}" 吗？` })
    await deleteWarehouse(w.warehouse_id)
    showToast('已删除')
    await load()
  } catch (e: any) {
    if (e !== 'cancel') showToast(e.response?.data?.message || '删除失败')
  }
}

async function load() {
  list.value = await getWarehouses()
}

onMounted(load)
</script>
