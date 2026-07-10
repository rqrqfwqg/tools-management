<template>
  <el-container style="height:100vh">
    <el-aside width="200px" style="background:#304156">
      <div class="logo">物料管理系统</div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/users" v-if="authStore.hasRole(['admin'])">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/depts" v-if="authStore.hasRole(['admin'])">
          <el-icon><OfficeBuilding /></el-icon>
          <span>部门管理</span>
        </el-menu-item>
        <el-menu-item index="/categories" v-if="authStore.hasRole(['admin'])">
          <el-icon><Collection /></el-icon>
          <span>工具分类</span>
        </el-menu-item>
        <el-sub-menu index="warehouse" v-if="authStore.hasRole(['admin'])">
          <template #title>
            <el-icon><House /></el-icon>
            <span>仓库管理</span>
          </template>
          <el-menu-item index="/warehouses">仓库</el-menu-item>
          <el-menu-item index="/shelves">货架</el-menu-item>
          <el-menu-item index="/locations">货位</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/tools">
          <el-icon><Box /></el-icon>
          <span>工器具</span>
        </el-menu-item>
        <el-sub-menu index="material">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>物料管理</span>
          </template>
          <el-menu-item index="/spare-parts">备件管理</el-menu-item>
          <el-menu-item index="/consumables">消耗品管理</el-menu-item>
          <el-menu-item index="/material-categories">物料分类</el-menu-item>
          <el-menu-item index="/stock-movements">出入库流水</el-menu-item>
          <el-menu-item index="/inventory-checks">盘库管理</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/toolkits" v-if="authStore.hasRole(['admin'])">
          <el-icon><Suitcase /></el-icon>
          <span>工具箱管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Document /></el-icon>
          <span>领用管理</span>
        </el-menu-item>
        <el-menu-item index="/roles" v-if="authStore.hasRole(['admin'])">
          <el-icon><Key /></el-icon>
          <span>角色管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:space-between">
        <span>当前用户：{{ authStore.user?.real_name || authStore.user?.username }}</span>
        <div style="display:flex;align-items:center;gap:15px">
          <el-badge :value="cartStore.totalItems" :hidden="cartStore.totalItems === 0" :max="99">
            <el-button @click="$router.push('/cart')">
              <el-icon><ShoppingCart /></el-icon>
              购物车
            </el-button>
          </el-badge>
          <el-dropdown @command="handleCommand">
            <el-button size="small">
              {{ authStore.user?.real_name || authStore.user?.username }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="changePassword">
                  <el-icon><Lock /></el-icon> 修改密码
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'
import { onMounted } from 'vue'
import { useAutoLogout } from '@/composables/useAutoLogout'
import { DataLine, User, OfficeBuilding, Collection, House, Box, Document, Key, ArrowDown, Lock, SwitchButton, ShoppingCart, Suitcase, Goods } from '@element-plus/icons-vue'
import type { ComponentSize } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const cartStore = useCartStore()

// 10分钟无操作自动退出
useAutoLogout(10)

onMounted(() => {
  if (!authStore.user) {
    authStore.fetchUserInfo()
  }
})

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const handleCommand = (command: string) => {
  if (command === 'changePassword') {
    router.push('/change-password')
  } else if (command === 'logout') {
    handleLogout()
  }
}
</script>

<style>
.logo {
  color: #fff;
  text-align: center;
  padding: 20px 0;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid #43556a;
}
.el-header {
  padding: 0 20px;
}
</style>
