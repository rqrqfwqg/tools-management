<template>
  <div class="page-container">
    <div style="text-align:center;padding:30px 0 20px">
      <van-icon name="contact" size="64" color="#1989fa" />
      <h3 style="margin-top:12px">{{ authStore.user?.real_name || '用户' }}</h3>
      <p style="color:#999;font-size:13px">{{ authStore.user?.phone || '' }}</p>
      <van-tag :type="authStore.isAdmin ? 'danger' : 'primary'" size="medium">
        {{ authStore.isAdmin ? '管理员' : '普通员工' }}
      </van-tag>
      <p style="color:#999;font-size:12px;margin-top:4px">{{ authStore.user?.dept_name || '' }}</p>
    </div>

    <van-cell-group inset>
      <van-cell title="工器具管理" icon="orders-o" is-link to="/tools" />
      <van-cell title="领用工单" icon="description" is-link to="/orders" />
      <van-cell title="领用篮" icon="cart-o" is-link to="/cart" :badge="cartCount || ''" />
    </van-cell-group>

    <div v-if="authStore.isAdmin" style="margin-top: 12px">
      <h4 style="font-size:14px;color:#666;padding: 0 16px;margin-bottom:8px">后台管理</h4>
      <van-cell-group inset>
        <van-cell title="仓库管理" icon="home-o" is-link to="/warehouses" />
        <van-cell title="用户管理" icon="friends-o" is-link to="/users" />
        <van-cell title="分类管理" icon="label-o" is-link to="/categories" />
        <van-cell title="部门管理" icon="cluster-o" is-link to="/depts" />
        <van-cell title="货架管理" icon="bar-chart-o" is-link to="/shelves" />
        <van-cell title="货位管理" icon="location-o" is-link to="/locations" />
      </van-cell-group>
    </div>

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

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '确认退出', message: '确定要退出登录吗？' })
    authStore.logout()
    router.push('/login')
    showToast('已退出')
  } catch {}
}
</script>
