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
        { path: 'users', name: 'UserManagement', component: () => import('@/views/UserManagement.vue') },
        { path: 'depts', name: 'DeptManagement', component: () => import('@/views/DeptManagement.vue') },
        { path: 'categories', name: 'CategoryManagement', component: () => import('@/views/CategoryManagement.vue') },
        { path: 'warehouses', name: 'WarehouseManagement', component: () => import('@/views/WarehouseManagement.vue') },
        { path: 'shelves', name: 'ShelfManagement', component: () => import('@/views/ShelfManagement.vue') },
        { path: 'locations', name: 'LocationManagement', component: () => import('@/views/LocationManagement.vue') },
        { path: 'tools', name: 'ToolManagement', component: () => import('@/views/ToolManagement.vue') },
        { path: 'orders', name: 'OrderManagement', component: () => import('@/views/OrderManagement.vue') },
        { path: 'roles', name: 'RoleManagement', component: () => import('@/views/RoleManagement.vue') },
        { path: 'change-password', name: 'ChangePassword', component: () => import('@/views/ChangePassword.vue') },
        { path: 'cart', name: 'ShoppingCart', component: () => import('@/views/ShoppingCart.vue') },
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    // 角色权限检查
    const adminOnlyRoutes = ['/users', '/depts', '/categories', '/warehouses', '/shelves', '/locations', '/roles']
    if (token && adminOnlyRoutes.some(r => to.path.startsWith(r))) {
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
  }
})

export default router
