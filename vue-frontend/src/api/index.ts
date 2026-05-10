import axios from 'axios'
import type { User, Dept, Category, Tool, Order, Role, DashboardStats } from '@/types'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 统一处理：清除过期 token 并跳转登录
request.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (username: string, password: string) => {
  return request.post('/auth/login', `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(r => r.data)
}

export const getUserInfo = () =>
  request.get('/auth/me').then(r => r.data)

// Dashboard
export const getDashboard = () =>
  request.get<DashboardStats>('/dashboard').then(r => r.data)

// Users
export const getUsers = () =>
  request.get<User[]>('/users').then(r => r.data)

export const createUser = (data: any) =>
  request.post('/users', data).then(r => r.data)

export const updateUser = (id: number, data: any) =>
  request.put(`/users/${id}`, data).then(r => r.data)

export const deleteUser = (id: number) =>
  request.delete(`/users/${id}`).then(r => r.data)

// Departments
export const getDepts = () =>
  request.get<Dept[]>('/departments').then(r => r.data)

export const createDept = (data: any) =>
  request.post('/departments', data).then(r => r.data)

export const updateDept = (id: number, data: any) =>
  request.put(`/departments/${id}`, data).then(r => r.data)

export const deleteDept = (id: number) =>
  request.delete(`/departments/${id}`).then(r => r.data)

// Categories
export const getCategories = () =>
  request.get<Category[]>('/tool-categories').then(r => r.data)

export const createCategory = (data: any) =>
  request.post('/tool-categories', data).then(r => r.data)

export const updateCategory = (id: number, data: any) =>
  request.put(`/tool-categories/${id}`, data).then(r => r.data)

export const deleteCategory = (id: number) =>
  request.delete(`/tool-categories/${id}`).then(r => r.data)

// Warehouses
export const getWarehouses = () =>
  request.get('/warehouses').then(r => r.data)

export const createWarehouse = (data: any) =>
  request.post('/warehouses', data).then(r => r.data)

export const updateWarehouse = (id: number, data: any) =>
  request.put(`/warehouses/${id}`, data).then(r => r.data)

export const deleteWarehouse = (id: number) =>
  request.delete(`/warehouses/${id}`).then(r => r.data)

// Shelves
export const getShelves = (params?: { warehouse_id?: number }) =>
  request.get('/shelves', { params }).then(r => r.data)

export const createShelf = (data: any) =>
  request.post('/shelves', data).then(r => r.data)

export const updateShelf = (id: number, data: any) =>
  request.put(`/shelves/${id}`, data).then(r => r.data)

export const deleteShelf = (id: number) =>
  request.delete(`/shelves/${id}`).then(r => r.data)

// Storage Locations
export const getStorageLocations = (params?: { shelf_id?: number; warehouse_id?: number }) =>
  request.get('/storage-locations', { params }).then(r => r.data)

export const createStorageLocation = (data: any) =>
  request.post('/storage-locations', data).then(r => r.data)

export const updateStorageLocation = (id: number, data: any) =>
  request.put(`/storage-locations/${id}`, data).then(r => r.data)

export const deleteStorageLocation = (id: number) =>
  request.delete(`/storage-locations/${id}`).then(r => r.data)

// Tools
export const getTools = () =>
  request.get<Tool[]>('/tools').then(r => r.data)

export const createTool = (data: any) =>
  request.post('/tools', data).then(r => r.data)

export const updateTool = (id: number, data: any) =>
  request.put(`/tools/${id}`, data).then(r => r.data)

export const deleteTool = (id: number) =>
  request.delete(`/tools/${id}`).then(r => r.data)

// Orders
export const getOrders = () =>
  request.get<Order[]>('/orders').then(r => r.data)

export const createOrder = (data: any) =>
  request.post('/orders', data).then(r => r.data)

export const approveOrder = (id: number) =>
  request.post(`/orders/${id}/approve`).then(r => r.data)

export const rejectOrder = (id: number) =>
  request.post(`/orders/${id}/reject`).then(r => r.data)

export const returnOrder = (id: number) =>
  request.post(`/orders/${id}/return`).then(r => r.data)

export const cancelOrder = (id: number) =>
  request.post(`/orders/${id}/cancel`).then(r => r.data)

export const deleteOrder = (id: number) =>
  request.delete(`/orders/${id}`).then(r => r.data)

// Roles
export const getRoles = () =>
  request.get<Role[]>('/roles').then(r => r.data)

export const createRole = (data: any) =>
  request.post('/roles', data).then(r => r.data)

export const updateRole = (id: number, data: any) =>
  request.put(`/roles/${id}`, data).then(r => r.data)

export const deleteRole = (id: number) =>
  request.delete(`/roles/${id}`).then(r => r.data)

// Password management
export const changePassword = (oldPassword: string, newPassword: string) =>
  request.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }).then(r => r.data)

export const resetPassword = (userId: number, newPassword: string) =>
  request.post(`/users/${userId}/reset-password`, { new_password: newPassword }).then(r => r.data)

export default request
