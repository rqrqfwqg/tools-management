<template>
  <view class="page">
    <view class="bar">
      <text class="bar__title">用户管理</text>
      <text class="bar__add" @tap="openAdd">+ 新增</text>
    </view>

    <view class="search">
      <input v-model="keyword" class="search__input" placeholder="搜索姓名/用户名/手机" placeholder-class="ph" />
    </view>

    <scroll-view scroll-y class="list">
      <view class="card" v-for="u in filtered" :key="u.user_id">
        <view class="card__main">
          <view class="row1">
            <text class="card__name">{{ u.real_name || u.username }}</text>
            <text class="tag" :class="u.role === 'admin' ? 'tag--admin' : 'tag--staff'">{{ u.role === 'admin' ? '管理员' : '员工' }}</text>
            <text class="tag tag--off" v-if="u.is_active === false">停用</text>
          </view>
          <text class="card__code">{{ u.username }} | {{ u.phone || '—' }}</text>
          <text class="card__code">{{ u.dept_name || '—' }}</text>
        </view>
        <view class="card__actions">
          <text class="act act--edit" @tap="openEdit(u)">编辑</text>
          <text class="act act--del" @tap="remove(u)">删除</text>
        </view>
      </view>
      <view class="tip" v-if="loaded && !filtered.length">暂无数据</view>
      <view class="tip" v-if="!loaded">加载中…</view>
    </scroll-view>

    <!-- 新增/编辑弹窗 -->
    <view v-if="showForm" class="mask" @tap="showForm = false">
      <view class="form" @tap.stop>
        <view class="form__title">{{ form.user_id ? '编辑用户' : '新增用户' }}</view>
        <view class="frow">
          <text class="flabel">登录账号</text>
          <input v-model="form.username" class="finput" placeholder="必填" />
        </view>
        <view class="frow">
          <text class="flabel">真实姓名</text>
          <input v-model="form.real_name" class="finput" placeholder="必填" />
        </view>
        <view class="frow">
          <text class="flabel">手机号</text>
          <input v-model="form.phone" class="finput" type="number" placeholder="员工手机号（微信登录匹配用）" />
        </view>
        <view class="frow" v-if="!form.user_id">
          <text class="flabel">初始密码</text>
          <input v-model="form.password" class="finput" placeholder="默认 123456" />
        </view>
        <view class="frow">
          <text class="flabel">部门</text>
          <picker mode="selector" :range="deptNames" @change="onDeptPick">
            <view class="finput finput--pick">{{ form.dept_name || '请选择' }}</view>
          </picker>
        </view>
        <view class="frow">
          <text class="flabel">角色</text>
          <view class="roles">
            <text class="role" :class="{ 'role--on': form.role === 'staff' }" @tap="form.role = 'staff'">员工</text>
            <text class="role" :class="{ 'role--on': form.role === 'admin' }" @tap="form.role = 'admin'">管理员</text>
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
import { getUsers, createUser, updateUser, deleteUser, getDepts } from '@/api'
import { toArray } from '@/utils/status'
import { showToast, showModal } from '@/utils/feedback'

const list = ref<any[]>([])
const depts = ref<any[]>([])
const loaded = ref(false)
const keyword = ref('')
const showForm = ref(false)
const form = ref<any>({})

const deptNames = computed(() => depts.value.map((d) => d.dept_name))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((u) =>
    String(u.real_name || '').toLowerCase().includes(kw) ||
    String(u.username || '').toLowerCase().includes(kw) ||
    String(u.phone || '').includes(kw)
  )
})

async function load() {
  loaded.value = false
  try {
    list.value = toArray(await getUsers().catch(() => []))
    if (!depts.value.length) {
      depts.value = toArray(await getDepts().catch(() => []))
    }
  } finally {
    loaded.value = true
  }
}

function onDeptPick(e: any) {
  const d = depts.value[Number(e.detail.value)]
  if (d) {
    form.value.dept_id = d.dept_id
    form.value.dept_name = d.dept_name
  }
}

function openAdd() {
  form.value = {
    username: '',
    real_name: '',
    phone: '',
    password: '123456',
    dept_id: depts.value[0]?.dept_id,
    dept_name: depts.value[0]?.dept_name,
    role: 'staff',
    is_active: true
  }
  showForm.value = true
}
function openEdit(u: any) {
  form.value = { ...u }
  showForm.value = true
}

async function save() {
  if (!form.value.username?.trim() || !form.value.real_name?.trim()) {
    showToast('请填写账号和姓名', 'none')
    return
  }
  try {
    const payload: any = {
      username: form.value.username,
      real_name: form.value.real_name,
      phone: form.value.phone || '',
      role: form.value.role || 'staff',
      dept_id: form.value.dept_id,
      is_active: form.value.is_active !== false
    }
    if (form.value.user_id) {
      await updateUser(form.value.user_id, payload)
    } else {
      payload.password = form.value.password || '123456'
      await createUser(payload)
    }
    showForm.value = false
    await showToast('保存成功', 'success')
    load()
  } catch (e: any) {
    await showToast(e?.data?.message || e?.message || '保存失败', 'none')
  }
}

async function remove(u: any) {
  const ok = await showModal({ title: '确认删除', content: `确定删除用户「${u.real_name || u.username}」？` })
  if (!ok) return
  try {
    await deleteUser(u.user_id)
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
.row1 { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.tag { padding: 2rpx 14rpx; border-radius: 999rpx; font-size: 20rpx;
  &--admin { color: $tm-danger; background: #ffebee; }
  &--staff { color: $tm-primary; background: #e8f3ff; }
  &--off { color: $tm-text-muted; background: $tm-border-light; }
}
.act { font-size: 26rpx;
  &--edit { color: $tm-primary; }
  &--del { color: $tm-danger; }
}
.tip { padding: 48rpx 0; text-align: center; font-size: 26rpx; color: $tm-text-muted; }
.mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 99; }
.form { width: 640rpx; background: $tm-card-bg; border-radius: $tm-radius; padding: 32rpx;
  &__title { font-size: 32rpx; font-weight: 600; color: $tm-text; margin-bottom: 24rpx; text-align: center; }
}
.frow { display: flex; align-items: center; margin-bottom: 20rpx;
  .flabel { width: 150rpx; font-size: 26rpx; color: $tm-text-secondary; flex-shrink: 0; }
  .finput { flex: 1; background: $tm-bg; border-radius: 12rpx; padding: 14rpx 20rpx; font-size: 26rpx; color: $tm-text;
    &--pick { color: $tm-text-secondary; }
  }
}
.roles { display: flex; gap: 20rpx;
  .role { padding: 10rpx 36rpx; border-radius: 999rpx; background: $tm-bg; color: $tm-text-secondary; font-size: 26rpx;
    &--on { background: $tm-primary; color: #fff; }
  }
}
.fbtns { display: flex; gap: 20rpx; margin-top: 32rpx;
  .fbtn { flex: 1; text-align: center; padding: 18rpx 0; border-radius: 999rpx; font-size: 28rpx;
    &--cancel { background: $tm-bg; color: $tm-text-secondary; }
    &--ok { background: $tm-primary; color: #fff; }
  }
}
</style>
