import axios from 'axios'
import type { User, Dept, Category, Tool, Order, Role, DashboardStats, SparePart, Consumable, MaterialCategory, StockMovement, InventoryCheck } from '@/types'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
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
    // 忽略请求取消（如页面跳转导致的 abort），避免日志噪音
    if (axios.isCancel(err)) {
      return Promise.reject(err)
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      // 用 replace 避免 history 堆积，且不会触发并行请求的级联取消
      location.replace('/login')
    }
    return Promise.reject(err)
  }
)

// Auth
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

export const getWarehouse = (id: number) =>
  request.get(`/warehouses/${id}`).then(r => r.data)

// Shelves
export const getShelves = (params?: { warehouse_id?: number }) =>
  request.get('/shelves', { params }).then(r => r.data)

export const createShelf = (data: any) =>
  request.post('/shelves', data).then(r => r.data)

export const updateShelf = (id: number, data: any) =>
  request.put(`/shelves/${id}`, data).then(r => r.data)

export const deleteShelf = (id: number) =>
  request.delete(`/shelves/${id}`).then(r => r.data)

export const getShelf = (id: number) =>
  request.get(`/shelves/${id}`).then(r => r.data)

// Storage Locations
export const getStorageLocations = (params?: { shelf_id?: number; warehouse_id?: number }) =>
  request.get('/storage-locations', { params }).then(r => r.data)

export const createStorageLocation = (data: any) =>
  request.post('/storage-locations', data).then(r => r.data)

export const updateStorageLocation = (id: number, data: any) =>
  request.put(`/storage-locations/${id}`, data).then(r => r.data)

export const deleteStorageLocation = (id: number) =>
  request.delete(`/storage-locations/${id}`).then(r => r.data)

export const getStorageLocation = (id: number) =>
  request.get(`/storage-locations/${id}`).then(r => r.data)

// Tools
export const getTools = () =>
  request.get<Tool[]>('/tools').then(r => r.data)

export const getToolkits = () =>
  request.get<any[]>('/toolkits').then(r => r.data)

export const getToolkitDetail = (id: number) =>
  request.get<any>(`/toolkits/${id}`).then(r => r.data)

export const createToolkit = (data: { toolkit_name: string; description?: string; toolkit_code?: string }) =>
  request.post('/toolkits', data).then(r => r.data)

export const updateToolkit = (id: number, data: any) =>
  request.put(`/toolkits/${id}`, data).then(r => r.data)

export const deleteToolkit = (id: number) =>
  request.delete(`/toolkits/${id}`).then(r => r.data)

export const addToolsToKit = (toolkitId: number, toolIds: number[]) =>
  request.post(`/toolkits/${toolkitId}/add-tools`, { tool_ids: toolIds }).then(r => r.data)

export const removeToolFromKit = (toolkitId: number, toolId: number) =>
  request.delete(`/toolkits/${toolkitId}/remove-tool/${toolId}`).then(r => r.data)

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

// Barcode — 按 tool_code 查询
export const getToolByCode = (code: string) =>
  request.get(`/tools/code/${encodeURIComponent(code)}`).then(r => r.data)

// ============ 物料管理 v3.0.0 ============

// 物料分类
export const getMaterialCategories = () =>
  request.get<MaterialCategory[]>('/material-categories').then(r => r.data)
export const createMaterialCategory = (data: any) =>
  request.post('/material-categories', data).then(r => r.data)
export const updateMaterialCategory = (id: number, data: any) =>
  request.put(`/material-categories/${id}`, data).then(r => r.data)
export const deleteMaterialCategory = (id: number) =>
  request.delete(`/material-categories/${id}`).then(r => r.data)

// 备件
export const getSpareParts = () =>
  request.get<SparePart[]>('/spare-parts').then(r => r.data)
export const createSparePart = (data: any) =>
  request.post('/spare-parts', data).then(r => r.data)
export const updateSparePart = (id: number, data: any) =>
  request.put(`/spare-parts/${id}`, data).then(r => r.data)
export const deleteSparePart = (id: number) =>
  request.delete(`/spare-parts/${id}`).then(r => r.data)
export const getSpareByCode = (code: string) =>
  request.get(`/spare-parts/code/${encodeURIComponent(code)}`).then(r => r.data)
export const borrowSpareByCode = (code: string, data?: any) =>
  request.post(`/spare-parts/code/${encodeURIComponent(code)}/borrow`, data || {}).then(r => r.data)
export const uploadSpareImage = (id: number, formData: FormData) =>
  request.post(`/spare-parts/${id}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
// 低库存备件（按型号聚合，返回纯数组，元素含 model/available_count/warning_qty/spare_ids）
export const getLowStockSpareParts = () =>
  request.get('/spare-parts/low-stock').then(r => r.data)

// 消耗品
export const getConsumables = () =>
  request.get<Consumable[]>('/consumables').then(r => r.data)
export const createConsumable = (data: any) =>
  request.post('/consumables', data).then(r => r.data)
export const updateConsumable = (id: number, data: any) =>
  request.put(`/consumables/${id}`, data).then(r => r.data)
export const deleteConsumable = (id: number) =>
  request.delete(`/consumables/${id}`).then(r => r.data)
export const getConsumableByCode = (code: string) =>
  request.get(`/consumables/code/${encodeURIComponent(code)}`).then(r => r.data)
export const takeConsumableByCode = (code: string, qty: number) =>
  request.post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty }).then(r => r.data)
export const getLowStockConsumables = () =>
  request.get<Consumable[]>('/consumables/low-stock').then(r => r.data)
export const uploadConsumableImage = (id: number, formData: FormData) =>
  request.post(`/consumables/${id}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)

// 出入库流水
export const getStockMovements = (params?: any) =>
  request.get('/stock-movements', { params }).then(r => r.data)
export const createStockMovement = (data: any) =>
  request.post('/stock-movements', data).then(r => r.data)

// 盘库
export const getInventoryChecks = () =>
  request.get<InventoryCheck[]>('/inventory-checks').then(r => r.data)
export const createInventoryCheck = (data: any) =>
  request.post('/inventory-checks', data).then(r => r.data)
export const getInventoryCheck = (id: number) =>
  request.get<InventoryCheck>(`/inventory-checks/${id}`).then(r => r.data)
export const scanInventoryCheck = (id: number, code: string, actual_qty?: number) =>
  request.post(`/inventory-checks/${id}/scan`, { code, actual_qty }).then(r => r.data)
export const completeInventoryCheck = (id: number) =>
  request.post(`/inventory-checks/${id}/complete`).then(r => r.data)

// Barcode — 按 toolkit_code 查询工具箱详情
export const getToolkitByCode = (code: string) =>
  request.get(`/toolkits/code/${encodeURIComponent(code)}`).then(r => r.data)

export default request
