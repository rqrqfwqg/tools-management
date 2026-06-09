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

// Warehouses
export const getWarehouses = () => api.get('/warehouses').then(r => r.data)
export const createWarehouse = (data: any) => api.post('/warehouses', data).then(r => r.data)
export const updateWarehouse = (id: number, data: any) => api.put(`/warehouses/${id}`, data).then(r => r.data)
export const deleteWarehouse = (id: number) => api.delete(`/warehouses/${id}`).then(r => r.data)

// Categories
export const getCategories = () => api.get('/categories').then(r => r.data)
export const createCategory = (data: any) => api.post('/categories', data).then(r => r.data)
export const updateCategory = (id: number, data: any) => api.put(`/categories/${id}`, data).then(r => r.data)
export const deleteCategory = (id: number) => api.delete(`/categories/${id}`).then(r => r.data)

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
export const createLocation = (data: any) => api.post('/locations', data).then(r => r.data)
export const updateLocation = (id: number, data: any) => api.put(`/locations/${id}`, data).then(r => r.data)
export const deleteLocation = (id: number) => api.delete(`/locations/${id}`).then(r => r.data)

// Roles
export const getRoles = () => api.get('/roles').then(r => r.data)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard').then(r => r.data)

// Upload — 上传工具图片（需要 token 鉴权 + material_manager 角色）
export const uploadToolImage = (toolId: number, formData: FormData) =>
  api.post(`/tools/${toolId}/upload-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)

export default api
