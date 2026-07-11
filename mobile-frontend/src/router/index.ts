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
    path: '/scan',
    name: 'Scan',
    component: () => import('@/views/ScanTool.vue'),
    meta: { title: '扫码' }
  },
  {
    path: '/spare-parts',
    name: 'SpareParts',
    component: () => import('@/views/SparePartList.vue'),
    meta: { title: '备件' }
  },
  {
    path: '/consumables',
    name: 'Consumables',
    component: () => import('@/views/ConsumableList.vue'),
    meta: { title: '消耗品' }
  },
  {
    path: '/material-center',
    name: 'MaterialCenter',
    component: () => import('@/views/MaterialCenter.vue'),
    meta: { title: '物料中心' }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/Inventory.vue'),
    meta: { title: '盘点' }
  },
  {
    path: '/stock-movements',
    name: 'StockMovements',
    component: () => import('@/views/StockMovement.vue'),
    meta: { title: '出入库流水' }
  },
  {
    path: '/material-dispense',
    name: 'MaterialDispense',
    component: () => import('@/views/MaterialDispense.vue'),
    meta: { title: '物料领用' }
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
