<template>
  <div class="page-container">
    <van-nav-bar title="货架管理" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-button type="primary" block round style="margin:10px 0" @click="openDialog()">新增货架</van-button>

    <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>

    <div v-for="s in filteredList" :key="s.shelf_id" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">{{ s.shelf_name }}</div>
          <div style="font-size:12px;color:#999">{{ s.shelf_code }} | {{ s.warehouse_name }}</div>
        </div>
        <div style="display:flex;gap:4px">
          <van-tag :type="s.is_active ? 'success' : 'danger'">{{ s.is_active ? '启用' : '停用' }}</van-tag>
          <van-button size="small" @click="openDialog(s)">编辑</van-button>
          <van-button size="small" type="danger" @click="handleDelete(s)">删除</van-button>
        </div>
      </div>
    </div>

    <van-dialog v-model:show="dialogVisible" title="货架" show-cancel-button @confirm="handleSave">
      <van-field v-model="form.shelf_name" label="名称" required />
      <van-field v-model="form.shelf_code" label="编码" required />
      <van-field name="warehouse_id" label="仓库">
        <template #input>
          <van-picker :columns="whColumns" @change="onWhChange" />
        </template>
      </van-field>
      <van-field name="is_active" label="启用">
        <template #input>
          <van-switch v-model="form.is_active" />
        </template>
      </van-field>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getShelves, createShelf, updateShelf, deleteShelf, getWarehouses } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const list = ref<any[]>([])
const warehouses = ref<any[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const form = ref<any>({ is_active: true })

const whColumns = computed(() => warehouses.value.map((w: any) => ({ text: w.warehouse_name, value: w.warehouse_id })))

const filteredList = computed(() => {
  return list.value.filter(s => {
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!s.shelf_name?.toLowerCase().includes(kw) && !s.shelf_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function onWhChange({ selectedValues }: any) { form.value.warehouse_id = selectedValues[0] }

function openDialog(data?: any) {
  form.value = data ? { ...data } : { shelf_name: '', shelf_code: '', warehouse_id: warehouses.value[0]?.warehouse_id, is_active: true }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    if (form.value.shelf_id) {
      await updateShelf(form.value.shelf_id, form.value)
    } else {
      await createShelf(form.value)
    }
    showToast('保存成功')
    dialogVisible.value = false
    await load()
  } catch (e: any) { showToast(e.response?.data?.message || '保存失败') }
}

async function handleDelete(s: any) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 "${s.shelf_name}" 吗？` })
    await deleteShelf(s.shelf_id)
    showToast('已删除')
    await load()
  } catch (e: any) { if (e !== 'cancel') showToast(e.response?.data?.message || '删除失败') }
}

async function load() {
  list.value = await getShelves()
  warehouses.value = await getWarehouses()
}
onMounted(load)
</script>
