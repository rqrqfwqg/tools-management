<template>
  <div class="page-container">
    <van-nav-bar title="货位管理" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-button type="primary" block round style="margin:10px 0" @click="openDialog()">新增货位</van-button>

    <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>

    <div v-for="l in filteredList" :key="l.location_id" class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">{{ l.location_name }}</div>
          <div style="font-size:12px;color:#999">{{ l.location_code }} | {{ l.shelf_name }} | {{ l.warehouse_name }}</div>
        </div>
        <div style="display:flex;gap:4px">
          <van-tag :type="l.is_active ? 'success' : 'danger'">{{ l.is_active ? '启用' : '停用' }}</van-tag>
          <van-button size="small" @click="openDialog(l)">编辑</van-button>
          <van-button size="small" type="danger" @click="handleDelete(l)">删除</van-button>
        </div>
      </div>
    </div>

    <van-dialog v-model:show="dialogVisible" title="货位" show-cancel-button @confirm="handleSave">
      <van-field v-model="form.location_name" label="名称" required />
      <van-field v-model="form.location_code" label="编码" required />
      <van-field name="shelf_id" label="货架">
        <template #input>
          <van-picker :columns="shelfColumns" @change="onShChange" />
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
import { getLocations, createLocation, updateLocation, deleteLocation, getShelves, getWarehouses } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const list = ref<any[]>([])
const shelves = ref<any[]>([])
const warehouses = ref<any[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const form = ref<any>({ is_active: true })

const shelfColumns = computed(() => shelves.value.map((s: any) => ({ text: s.shelf_name, value: s.shelf_id })))

const filteredList = computed(() => {
  return list.value.filter(l => {
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!l.location_name?.toLowerCase().includes(kw) && !l.location_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function onShChange({ selectedValues }: any) { form.value.shelf_id = selectedValues[0] }

function openDialog(data?: any) {
  form.value = data ? { ...data } : { location_name: '', location_code: '', shelf_id: shelves.value[0]?.shelf_id, is_active: true }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    if (form.value.location_id) {
      await updateLocation(form.value.location_id, form.value)
    } else {
      await createLocation(form.value)
    }
    showToast('保存成功')
    dialogVisible.value = false
    await load()
  } catch (e: any) { showToast(e.response?.data?.message || '保存失败') }
}

async function handleDelete(l: any) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 "${l.location_name}" 吗？` })
    await deleteLocation(l.location_id)
    showToast('已删除')
    await load()
  } catch (e: any) { if (e !== 'cancel') showToast(e.response?.data?.message || '删除失败') }
}

async function load() {
  list.value = await getLocations()
  shelves.value = await getShelves()
  warehouses.value = await getWarehouses()
}
onMounted(load)
</script>
