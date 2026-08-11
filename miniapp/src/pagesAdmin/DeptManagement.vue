<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">部门管理</text>
      <text class="bar__add" @tap="openAdd">+ 新增</text>
    </view>

    <view class="search">
      <input v-model="keyword" class="search__input" placeholder="搜索名称/编码" placeholder-class="ph" />
    </view>

    <scroll-view scroll-y class="list">
      <view class="card" v-for="d in filtered" :key="d.dept_id">
        <view class="card__main">
          <text class="card__name">{{ d.dept_name }}</text>
          <text class="card__code">{{ d.dept_code }}</text>
        </view>
        <view class="card__actions">
          <text class="act act--edit" @tap="openEdit(d)">编辑</text>
          <text class="act act--del" @tap="remove(d)">删除</text>
        </view>
      </view>
      <view class="tip" v-if="loaded && !filtered.length">暂无数据</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>

    <!-- 新增/编辑弹窗 -->
    <view v-if="showForm" class="mask" @tap="showForm = false">
      <view class="form" @tap.stop>
        <view class="form__title">{{ form.dept_id ? '编辑部门' : '新增部门' }}</view>
        <view class="frow">
          <text class="flabel">名称</text>
          <input v-model="form.dept_name" class="finput" placeholder="必填" />
        </view>
        <view class="frow">
          <text class="flabel">编码</text>
          <input v-model="form.dept_code" class="finput" placeholder="必填" />
        </view>
        <view class="fbtns">
          <view class="fbtn fbtn--cancel" @tap="showForm = false">取消</view>
          <view class="fbtn fbtn--ok" @tap="save">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getDepts, createDept, updateDept, deleteDept } from '@/api'
import { toArray } from '@/utils/status'
import { showToast, showModal } from '@/utils/feedback'

const list = ref<any[]>([])
const loaded = ref(false)
const keyword = ref('')
const showForm = ref(false)
const form = ref<any>({})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((d) =>
    String(d.dept_name || '').toLowerCase().includes(kw) || String(d.dept_code || '').toLowerCase().includes(kw)
  )
})

async function load() {
  loaded.value = false
  try {
    list.value = toArray(await getDepts().catch(() => []))
  } finally {
    loaded.value = true
  }
}

function openAdd() {
  form.value = { dept_name: '', dept_code: '' }
  showForm.value = true
}
function openEdit(d: any) {
  form.value = { ...d }
  showForm.value = true
}

async function save() {
  if (!form.value.dept_name?.trim()) {
    showToast('请填写名称', 'none')
    return
  }
  try {
    if (form.value.dept_id) {
      await updateDept(form.value.dept_id, { dept_name: form.value.dept_name, dept_code: form.value.dept_code || '' })
    } else {
      await createDept({ dept_name: form.value.dept_name, dept_code: form.value.dept_code || '' })
    }
    showForm.value = false
    await showToast('保存成功', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '保存失败', 'none')
  }
}

async function remove(d: any) {
  const ok = await showModal({ title: '确认删除', content: `确定删除部门「${d.dept_name}」？` })
  if (!ok) return
  try {
    await deleteDept(d.dept_id)
    await showToast('已删除', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '删除失败', 'none')
  }
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: $tm-bg; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 32rpx; background: $tm-card-bg;
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; }
  &__add { font-size: 28rpx; color: $tm-primary; }
}
.search { padding: 16rpx 24rpx 4rpx;
  &__input { background: $tm-card-bg; border-radius: 999rpx; padding: 16rpx 28rpx; font-size: 26rpx; }
}
.ph { color: $tm-text-muted; }
.list { flex: 1; padding: 16rpx 24rpx 40rpx; box-sizing: border-box; }
.card { display: flex; align-items: center; justify-content: space-between; background: $tm-card-bg; border-radius: $tm-radius-sm;
  padding: 24rpx 28rpx; margin-bottom: 16rpx; box-shadow: $tm-shadow-card;
  &__main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  &__name { font-size: 30rpx; color: $tm-text; font-weight: 500; }
  &__code { margin-top: 6rpx; font-size: 24rpx; color: $tm-text-muted; }
  &__actions { display: flex; gap: 24rpx; }
}
.act { font-size: 26rpx;
  &--edit { color: $tm-primary; }
  &--del { color: $tm-danger; }
}
.tip { padding: 48rpx 0; text-align: center; font-size: 26rpx; color: $tm-text-muted; }
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 99; }
.form { width: 620rpx; background: $tm-card-bg; border-radius: $tm-radius; padding: 32rpx;
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; margin-bottom: 24rpx; text-align: center; }
}
.frow { display: flex; align-items: center; margin-bottom: 20rpx;
  .flabel { width: 120rpx; font-size: 26rpx; color: $tm-text-secondary; flex-shrink: 0; }
  .finput { flex: 1; background: $tm-bg; border-radius: 12rpx; padding: 14rpx 20rpx; font-size: 26rpx; color: $tm-text; }
}
.fbtns { display: flex; gap: 20rpx; margin-top: 32rpx;
  .fbtn { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 999rpx; font-size: 28rpx;
    &--cancel { background: $tm-bg; color: $tm-text-secondary; }
    &--ok { background: $tm-primary; color: #fff; }
  }
}
</style>
