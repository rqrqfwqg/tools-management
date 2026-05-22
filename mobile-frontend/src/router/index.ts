import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '仪表盘' }
  },
  {
    path: '/tools',
    name: 'Tools',
    component: () => import('@/views/ToolManagement.vue'),
    meta: { title: '工器具' }
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/OrderManagement.vue'),
    meta: { title: '领用工单' }
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/views/ShoppingCart.vue'),
    meta: { title: '领用篮' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '我的' }
  },
  {
    path: '/warehouses',
    name: 'Warehouses',
    component: () => import('@/views/WarehouseManagement.vue'),
    meta: { title: '仓库管理' }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/UserManagement.vue'),
    meta: { title: '用户管理' }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: () => import('@/views/CategoryManagement.vue'),
    meta: { title: '分类管理' }
  },
  {
    path: '/depts',
    name: 'Depts',
    component: () => import('@/views/DeptManagement.vue'),
    meta: { title: '部门管理' }
  },
  {
    path: '/shelves',
    name: 'Shelves',
    component: () => import('@/views/ShelfManagement.vue'),
    meta: { title: '货架管理' }
  },
  {
    path: '/locations',
    name: 'Locations',
    component: () => import('@/views/LocationManagement.vue'),
    meta: { title: '货位管理' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.name !== 'Login' && !authStore.isLoggedIn) {
    next('/login')
  } else if (to.name === 'Login' && authStore.isLoggedIn) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
