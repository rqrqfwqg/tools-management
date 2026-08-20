// 物料管理 API（v3.0.0）—— 复用既有 axios 实例，保持鉴权行为一致
import api from '@/api'

// 物料分类
export const getMaterialCategories = () => api.get('/material-categories').then(r => r.data)
export const createMaterialCategory = (data: any) => api.post('/material-categories', data).then(r => r.data)
export const updateMaterialCategory = (id: number, data: any) => api.put(`/material-categories/${id}`, data).then(r => r.data)
export const deleteMaterialCategory = (id: number) => api.delete(`/material-categories/${id}`).then(r => r.data)

// 备件
export const getSpareParts = () => api.get('/spare-parts').then(r => r.data)
export const getSpareByCode = (code: string) =>
  api.get(`/spare-parts/code/${encodeURIComponent(code)}`).then(r => r.data)
export const borrowSpareByCode = (code: string, data?: { scene?: string; expected_return?: string; purpose?: string }) =>
  api.post(`/spare-parts/code/${encodeURIComponent(code)}/borrow`, data || {}).then(r => r.data)

// 消耗品
export const getConsumables = () => api.get('/consumables').then(r => r.data)
export const getConsumableByCode = (code: string) =>
  api.get(`/consumables/code/${encodeURIComponent(code)}`).then(r => r.data)
export const takeConsumableByCode = (code: string, qty: number) =>
  api.post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty }).then(r => r.data)
export const getLowStockConsumables = () => api.get('/consumables/low-stock').then(r => r.data)

// 出入库流水
export const getStockMovements = (params?: any) => api.get('/stock-movements', { params }).then(r => r.data)

// 盘库
export const getInventoryChecks = () => api.get('/inventory-checks').then(r => r.data)
export const getInventoryCheckById = (id: number) =>
  api.get(`/inventory-checks/${id}`).then(r => r.data)
export const createInventoryCheck = (data: { warehouse_id: number; operator?: string }) =>
  api.post('/inventory-checks', data).then(r => r.data)
export const scanInventoryCheck = (id: number, code: string, actual_qty?: number) =>
  api.post(`/inventory-checks/${id}/scan`, { code, actual_qty }).then(r => r.data)
// resolve-only：扫货位码/物料码，仅解析返回物料+系统库存（不写入实盘），用于扫码定位应盘项
export const resolveInventoryCheck = (id: number, code: string) =>
  api.post(`/inventory-checks/${id}/scan`, { code }).then(r => r.data)
export const completeInventoryCheck = (id: number) =>
  api.post(`/inventory-checks/${id}/complete`).then(r => r.data)

export default api
