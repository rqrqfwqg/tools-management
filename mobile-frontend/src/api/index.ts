import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (phone: string, password: string) =>
  api.post('/auth/login', { phone, password }).then(r => r.data)

// Users
export const getUsers = () => api.get('/users').then(r => r.data)
export const createUser = (data: any) => api.post('/users', data).then(r => r.data)
export const updateUser = (id: number, data: any) => api.put(`/users/${id}`, data).then(r => r.data)
export const deleteUser = (id: number) => api.delete(`/users/${id}`).then(r => r.data)
export const resetPassword = (id: number, password: string) =>
  api.put(`/users/${id}/reset-password`, { password }).then(r => r.data)

// Tools
export const getTools = () => api.get('/tools').then(r => r.data)
export const getToolkits = () => api.get('/toolkits').then(r => r.data)
export const getToolkitDetail = (id: number) => api.get(`/toolkits/${id}`).then(r => r.data)
export const createTool = (data: any) => api.post('/tools', data).then(r => r.data)
export const updateTool = (id: number, data: any) => api.put(`/tools/${id}`, data).then(r => r.data)
export const deleteTool = (id: number) => api.delete(`/tools/${id}`).then(r => r.data)

// Orders
export const getOrders = () => api.get('/orders').then(r => r.data)
export const createOrder = (data: any) => api.post('/orders', data).then(r => r.data)
export const updateOrderStatus = (id: number, status: string) =>
  api.put(`/orders/${id}/status`, { status }).then(r => r.data)
export const returnOrder = (id: number) => api.post(`/orders/${id}/return`).then(r => r.data)

// Checklist — 现场清点
export const getChecklist = (orderId: number) => api.get(`/orders/${orderId}/checklist`).then(r => r.data)
export const saveChecklistItem = (orderId: number, toolId: number, checked: boolean) =>
  api.post(`/orders/${orderId}/checklist`, { tool_id: toolId, checked }).then(r => r.data)

// Warehouses
export const getWarehouses = () => api.get('/warehouses').then(r => r.data)
export const createWarehouse = (data: any) => api.post('/warehouses', data).then(r => r.data)
export const updateWarehouse = (id: number, data: any) => api.put(`/warehouses/${id}`, data).then(r => r.data)
export const deleteWarehouse = (id: number) => api.delete(`/warehouses/${id}`).then(r => r.data)

// Categories
export const getCategories = () => api.get('/tool-categories').then(r => r.data)
export const createCategory = (data: any) => api.post('/tool-categories', data).then(r => r.data)
export const updateCategory = (id: number, data: any) => api.put(`/tool-categories/${id}`, data).then(r => r.data)
export const deleteCategory = (id: number) => api.delete(`/tool-categories/${id}`).then(r => r.data)

// Depts
export const getDepts = () => api.get('/departments').then(r => r.data)
export const createDept = (data: any) => api.post('/departments', data).then(r => r.data)
export const updateDept = (id: number, data: any) => api.put(`/departments/${id}`, data).then(r => r.data)
export const deleteDept = (id: number) => api.delete(`/departments/${id}`).then(r => r.data)

// Shelves
export const getShelves = () => api.get('/shelves').then(r => r.data)
export const createShelf = (data: any) => api.post('/shelves', data).then(r => r.data)
export const updateShelf = (id: number, data: any) => api.put(`/shelves/${id}`, data).then(r => r.data)
export const deleteShelf = (id: number) => api.delete(`/shelves/${id}`).then(r => r.data)

// Locations
export const getLocations = () => api.get('/storage-locations').then(r => r.data)
export const createLocation = (data: any) => api.post('/storage-locations', data).then(r => r.data)
export const updateLocation = (id: number, data: any) => api.put(`/storage-locations/${id}`, data).then(r => r.data)
export const deleteLocation = (id: number) => api.delete(`/storage-locations/${id}`).then(r => r.data)

// Roles
export const getRoles = () => api.get('/roles').then(r => r.data)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard').then(r => r.data)

// Upload — 上传工具图片（需要 token 鉴权 + material_manager 角色）
export const uploadToolImage = (toolId: number, formData: FormData) =>
  api.post(`/tools/${toolId}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)

// Scan — 按 tool_code 查询工具
export const getToolByCode = (code: string) =>
  api.get(`/tools/code/${encodeURIComponent(code)}`).then(r => r.data)

// Scan — 按 toolkit_code 查询工具箱详情（含内部工具列表）
export const getToolkitByCode = (code: string) =>
  api.get(`/toolkits/code/${encodeURIComponent(code)}`).then(r => r.data)

// Scan — 按 tool_code 快速领用（单件工具）
export const borrowToolByCode = (code: string, data?: { scene?: string; expected_return?: string; purpose?: string }) =>
  api.post(`/tools/code/${encodeURIComponent(code)}/borrow`, data || {}).then(r => r.data)

export default api
