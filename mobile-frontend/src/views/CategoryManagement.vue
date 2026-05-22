<template>
  <div class="page-container">
    <van-nav-bar title="分类管理" left-text="返回" left-arrow @click-left="$router.back()" fixed placeholder />

    <van-search v-model="keyword" placeholder="搜索名称/编码" shape="round" />

    <van-button type="primary" block round style="margin:10px 0" @click="openDialog()">新增分类</van-button>

    <div v-if="filteredList.length === 0" class="empty-state"><p>暂无数据</p></div>

    <van-cell-group inset>
      <van-cell v-for="c in filteredList" :key="c.category_id" :title="c.category_name" :label="c.category_code">
        <template #right-icon>
          <van-button size="small" @click="openDialog(c)" style="margin-right:4px">编辑</van-button>
          <van-button size="small" type="danger" @click="handleDelete(c)">删除</van-button>
        </template>
      </van-cell>
    </van-cell-group>

    <van-dialog v-model:show="dialogVisible" title="分类" show-cancel-button @confirm="handleSave">
      <van-field v-model="form.category_name" label="名称" required />
      <van-field v-model="form.category_code" label="编码" required />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api'
import { showToast, showConfirmDialog } from 'vant'

const list = ref<any[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const form = ref<any>({})

const filteredList = computed(() => {
  return list.value.filter(c => {
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      if (!c.category_name?.toLowerCase().includes(kw) && !c.category_code?.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function openDialog(data?: any) {
  form.value = data ? { ...data } : { category_name: '', category_code: '' }
  dialogVisible.value = true
}

async function handleSave() {
  try {
    if (form.value.category_id) {
      await updateCategory(form.value.category_id, form.value)
    } else {
      await createCategory(form.value)
    }
    showToast('保存成功')
    dialogVisible.value = false
    await load()
  } catch (e: any) { showToast(e.response?.data?.message || '保存失败') }
}

async function handleDelete(c: any) {
  try {
    await showConfirmDialog({ title: '确认删除', message: `确定删除 "${c.category_name}" 吗？` })
    await deleteCategory(c.category_id)
    showToast('已删除')
    await load()
  } catch (e: any) { if (e !== 'cancel') showToast(e.response?.data?.message || '删除失败') }
}

async function load() { list.value = await getCategories() }
onMounted(load)
</script>
