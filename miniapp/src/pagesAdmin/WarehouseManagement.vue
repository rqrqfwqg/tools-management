<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">仓库管理</text>
      <text class="bar__add" @tap="openAdd">+ 新增</text>
    </view>

    <view class="search">
      <input v-model="keyword" class="search__input" placeholder="搜索名称/编码" placeholder-class="ph" />
    </view>

    <scroll-view scroll-y class="list">
      <view class="card" v-for="w in filtered" :key="w.warehouse_id">
        <view class="card__main">
          <view class="row1">
            <text class="card__name">{{ w.warehouse_name }}</text>
            <text class="tag" :class="w.is_active === false ? 'tag--off' : 'tag--on'">{{ w.is_active === false ? '停用' : '启用' }}</text>
          </view>
          <text class="card__code">{{ w.warehouse_code }}</text>
        </view>
        <view class="card__actions">
          <text class="act act--edit" @tap="openEdit(w)">编辑</text>
          <text class="act act--del" @tap="remove(w)">删除</text>
        </view>
      </view>
      <view class="tip" v-if="loaded && !filtered.length">暂无数据</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>

    <view v-if="showForm" class="mask" @tap="showForm = false">
      <view class="form" @tap.stop>
        <view class="form__title">{{ form.warehouse_id ? '编辑仓库' : '新增仓库' }}</view>
        <view class="frow">
          <text class="flabel">名称</text>
          <input v-model="form.warehouse_name" class="finput" placeholder="必填" />
        </view>
        <view class="frow">
          <text class="flabel">编码</text>
          <input v-model="form.warehouse_code" class="finput" placeholder="必填" />
        </view>
        <view class="frow">
          <text class="flabel">启用</text>
          <view class="switch" :class="{ 'switch--on': form.is_active !== false }" @tap="form.is_active = form.is_active !== false ? false : true">
            <text class="switch__txt">{{ form.is_active !== false ? '启用' : '停用' }}</text>
          </view>
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
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/api'
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
  return list.value.filter((w) =>
    String(w.warehouse_name || '').toLowerCase().includes(kw) || String(w.warehouse_code || '').toLowerCase().includes(kw)
  )
})

async function load() {
  loaded.value = false
  try {
    list.value = toArray(await getWarehouses().catch(() => []))
  } finally {
    loaded.value = true
  }
}

function openAdd() {
  form.value = { warehouse_name: '', warehouse_code: '', is_active: true }
  showForm.value = true
}
function openEdit(w: any) {
  form.value = { ...w }
  showForm.value = true
}

async function save() {
  if (!form.value.warehouse_name?.trim()) {
    showToast('请填写名称', 'none')
    return
  }
  try {
    const payload = { warehouse_name: form.value.warehouse_name, warehouse_code: form.value.warehouse_code || '', is_active: form.value.is_active !== false }
    if (form.value.warehouse_id) {
      await updateWarehouse(form.value.warehouse_id, payload)
    } else {
      await createWarehouse(payload)
    }
    showForm.value = false
    await showToast('保存成功', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '保存失败', 'none')
  }
}

async function remove(w: any) {
  const ok = await showModal({ title: '确认删除', content: `确定删除仓库「${w.warehouse_name}」？` })
  if (!ok) return
  try {
    await deleteWarehouse(w.warehouse_id)
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
.row1 { display: flex; align-items: center; gap: 16rpx; }
.tag { padding: 2rpx 14rpx; border-radius: 999rpx; font-size: 20rpx;
  &--on { color: $tm-success; background: #e8f8ef; }
  &--off { color: $tm-danger; background: #ffebee; }
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
.switch { margin-left: auto; padding: 8rpx 28rpx; border-radius: 999rpx; background: $tm-bg; color: $tm-text-muted; font-size: 24rpx;
  &--on { background: $tm-success; color: #fff; }
}
.fbtns { display: flex; gap: 20rpx; margin-top: 32rpx;
  .fbtn { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 999rpx; font-size: 28rpx;
    &--cancel { background: $tm-bg; color: $tm-text-secondary; }
    &--ok { background: $tm-primary; color: #fff; }
  }
}
</style>
