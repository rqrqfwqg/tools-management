<template>
  <div class="page-container">
    <div style="text-align:center;padding:30px 0 20px">
      <van-icon name="contact" size="64" color="#1989fa" />
      <h3 style="margin-top:12px">{{ authStore.user?.real_name || '用户' }}</h3>
      <p style="color:#999;font-size:13px">{{ authStore.user?.phone || '' }}</p>
      <van-tag :type="roleTagType" size="medium">
        {{ roleLabel }}
      </van-tag>
      <p style="color:#999;font-size:12px;margin-top:4px">{{ authStore.user?.dept_name || '' }}</p>
    </div>

    <van-cell-group inset>
      <van-cell title="工器具管理" icon="orders-o" is-link to="/tools" />
      <van-cell title="领用工单" icon="description" is-link to="/orders" />
      <van-cell title="领用篮" icon="cart-o" is-link to="/cart" :badge="cartCount || ''" />
    </van-cell-group>

    <div style="margin:24px 16px">
      <van-button round block type="danger" @click="handleLogout">退出登录</van-button>
    </div>

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <van-tabbar-item icon="description" to="/orders">工单</van-tabbar-item>
      <van-tabbar-item icon="contact" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'
import { showConfirmDialog, showToast } from 'vant'

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const active = ref(3)
const cartCount = computed(() => cartStore.count)

const roleLabels: Record<string, string> = {
  admin: '管理员', team_leader: '分队长', material_manager: '物料管理员', staff: '普通员工'
}
const roleLabel = computed(() => roleLabels[authStore.user?.role || ''] || '普通员工')
const roleTagType = computed(() => {
  const r = authStore.user?.role
  return r === 'admin' ? 'danger' : r === 'team_leader' ? 'warning' : 'primary'
})

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '确认退出', message: '确定要退出登录吗？' })
    authStore.logout()
    router.push('/login')
    showToast('已退出')
  } catch {}
}
</script>
