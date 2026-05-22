<template>
  <div class="page-container">
    <div class="page-title">仪表盘</div>

    <van-grid :column-num="2" :gutter="10">
      <van-grid-item text="工器具总数" :badge="String(stats.tools_total || 0)" icon="orders-o" @click="$router.push('/tools')" />
      <van-grid-item text="用户总数" :badge="String(stats.users_total || 0)" icon="friends-o" @click="$router.push('/users')" />
      <van-grid-item text="可用工具" :badge="String(stats.tools_available || 0)" icon="passed" @click="$router.push('/tools?status=available')" />
      <van-grid-item text="借出工具" :badge="String(stats.tools_borrowed || 0)" icon="points" @click="$router.push('/tools?status=borrowed')" />
    </van-grid>

    <van-grid :column-num="2" :gutter="10" style="margin-top: 10px">
      <van-grid-item text="待审核工单" :badge="String(stats.orders_pending || 0)" icon="description" @click="$router.push('/orders?status=pending')" />
      <van-grid-item text="已批准工单" :badge="String(stats.orders_approved || 0)" icon="certificate" @click="$router.push('/orders?status=approved')" />
      <van-grid-item text="维修中" :badge="String(stats.tools_maintenance || 0)" icon="repair" @click="$router.push('/tools?status=maintenance')" />
      <van-grid-item text="已归还" :badge="String(stats.orders_returned || 0)" icon="logistics" @click="$router.push('/orders?status=returned')" />
    </van-grid>

    <!-- 快捷操作 -->
    <div style="margin-top: 16px">
      <h3 style="font-size: 16px; margin-bottom: 10px; color: #323233">快捷操作</h3>
      <van-cell-group inset>
        <van-cell title="工器具管理" icon="orders-o" is-link to="/tools" />
        <van-cell title="领用工单" icon="description" is-link to="/orders" />
        <van-cell title="领用篮" icon="cart-o" is-link to="/cart" :badge="cartCount || ''" />
      </van-cell-group>
    </div>

    <!-- 管理员操作 -->
    <div v-if="authStore.isAdmin" style="margin-top: 12px">
      <h3 style="font-size: 16px; margin-bottom: 10px; color: #323233">后台管理</h3>
      <van-cell-group inset>
        <van-cell title="仓库管理" icon="home-o" is-link to="/warehouses" />
        <van-cell title="用户管理" icon="friends-o" is-link to="/users" />
        <van-cell title="分类管理" icon="label-o" is-link to="/categories" />
        <van-cell title="部门管理" icon="cluster-o" is-link to="/depts" />
        <van-cell title="货架管理" icon="bar-chart-o" is-link to="/shelves" />
        <van-cell title="货位管理" icon="location-o" is-link to="/locations" />
      </van-cell-group>
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
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'
import { getDashboardStats } from '@/api'
import { useAutoLogout } from '@/composables/useAutoLogout'

const authStore = useAuthStore()
const cartStore = useCartStore()
useAutoLogout(10)

const stats = ref<Record<string, number>>({})
const cartCount = computed(() => cartStore.count)

const active = ref(0)

onMounted(async () => {
  try {
    stats.value = await getDashboardStats()
  } catch (e) {
    console.error('加载仪表盘失败', e)
  }
})
</script>
