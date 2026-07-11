<template>
  <div class="page-container">
    <div class="page-title">仪表盘</div>

    <van-grid :column-num="2" :gutter="10">
      <van-grid-item text="工器具总数" :badge="String(stats.tools_total || 0)" icon="orders-o" @click="$router.push('/tools')" />
      <van-grid-item text="可用工具" :badge="String(stats.tools_available || 0)" icon="passed" @click="$router.push('/tools?status=available')" />
      <van-grid-item text="借出工具" :badge="String(stats.tools_borrowed || 0)" icon="points" @click="$router.push('/tools?status=borrowed')" />
      <van-grid-item text="待审核工单" :badge="String(stats.orders_pending || 0)" icon="description" @click="$router.push('/orders?status=pending')" />
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

    <van-tabbar v-model="active" route active-color="#1989fa" inactive-color="#999" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
      <van-tabbar-item icon="orders-o" to="/tools">工具</van-tabbar-item>
      <van-tabbar-item icon="apps-o" to="/material-center">物料</van-tabbar-item>
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

const authStore = useAuthStore()
const cartStore = useCartStore()

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
