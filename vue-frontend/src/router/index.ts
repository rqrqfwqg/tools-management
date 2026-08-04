import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
    {
      path: '/',
      component: MainLayout,
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue') },
        { path: 'users', name: 'UserManagement', component: () => import('@/views/UserManagement.vue'), meta: { requireAdmin: true } },
        { path: 'depts', name: 'DeptManagement', component: () => import('@/views/DeptManagement.vue'), meta: { requireAdmin: true } },
        { path: 'categories', name: 'CategoryManagement', component: () => import('@/views/CategoryManagement.vue'), meta: { requireAdmin: true } },
        { path: 'warehouses', name: 'WarehouseManagement', component: () => import('@/views/WarehouseManagement.vue'), meta: { requireAdmin: true } },
        { path: 'shelves', name: 'ShelfManagement', component: () => import('@/views/ShelfManagement.vue'), meta: { requireAdmin: true } },
        { path: 'locations', name: 'LocationManagement', component: () => import('@/views/LocationManagement.vue'), meta: { requireAdmin: true } },
        { path: 'toolkits', name: 'ToolkitManagement', component: () => import('@/views/ToolkitManagement.vue'), meta: { requireAdmin: true } },
        { path: 'tools', name: 'ToolManagement', component: () => import('@/views/ToolManagement.vue') },
        { path: 'spare-parts', name: 'SparePartManagement', component: () => import('@/views/SparePartManagement.vue') },
        { path: 'consumables', name: 'ConsumableManagement', component: () => import('@/views/ConsumableManagement.vue') },
        { path: 'material-categories', name: 'MaterialCategoryManagement', component: () => import('@/views/MaterialCategoryManagement.vue') },
        { path: 'stock-movements', name: 'StockMovement', component: () => import('@/views/StockMovement.vue') },
        { path: 'inventory-checks', name: 'InventoryCheck', component: () => import('@/views/InventoryCheck.vue') },
        { path: 'orders', name: 'OrderManagement', component: () => import('@/views/OrderManagement.vue') },
        { path: 'material-orders', name: 'MaterialOrderManagement', component: () => import('@/views/MaterialOrderManagement.vue') },
        { path: 'material-cart', name: 'MaterialCartView', component: () => import('@/views/MaterialCartView.vue') },
        { path: 'roles', name: 'RoleManagement', component: () => import('@/views/RoleManagement.vue'), meta: { requireAdmin: true } },
        { path: 'change-password', name: 'ChangePassword', component: () => import('@/views/ChangePassword.vue') },
        { path: 'cart', name: 'ShoppingCart', component: () => import('@/views/ShoppingCart.vue') },
        { path: 'barcodes', name: 'BarcodeList', component: () => import('@/views/BarcodeList.vue') },
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')

  // 未登录用户只能访问登录页
  if (to.path !== '/login' && !token) {
    next('/login')
    return
  }

  // 已登录用户访问登录页时重定向到首页
  if (to.path === '/login' && token) {
    next('/dashboard')
    return
  }

  // 管理员权限检查（从 JWT payload 中读取，避免额外请求）
  if (to.meta?.requireAdmin && token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.role !== 'admin') {
        next('/dashboard')
        return
      }
    } catch {
      next('/login')
      return
    }
  }

  next()
})

export default router
