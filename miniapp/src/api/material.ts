/**
 * 物料管理 API（小程序适配版，v3.0.0）
 * 自 mobile-frontend/src/api/material.ts 拷贝并适配：
 * axios 实例 → utils/request.ts，其余签名/返回类型保持不变。
 */
import { get, post, put, del } from '@/utils/request'

// ===== 物料分类 =====
export const getMaterialCategories = () => get('/material-categories')
export const createMaterialCategory = (data: any) => post('/material-categories', data)
export const updateMaterialCategory = (id: number, data: any) => put(`/material-categories/${id}`, data)
export const deleteMaterialCategory = (id: number) => del(`/material-categories/${id}`)

// ===== 备件 =====
export const getSpareParts = () => get('/spare-parts')
export const getSpareByCode = (code: string) =>
  get(`/spare-parts/code/${encodeURIComponent(code)}`)
export const borrowSpareByCode = (code: string, data?: { scene?: string; expected_return?: string; purpose?: string }) =>
  post(`/spare-parts/code/${encodeURIComponent(code)}/borrow`, data || {})

// ===== 消耗品 =====
export const getConsumables = () => get('/consumables')
export const getConsumableByCode = (code: string) =>
  get(`/consumables/code/${encodeURIComponent(code)}`)
export const takeConsumableByCode = (code: string, qty: number) =>
  post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty })
export const getLowStockConsumables = () => get('/consumables/low-stock')

// ===== 出入库流水 =====
export const getStockMovements = (params?: any) => get('/stock-movements', params)

// ===== 盘库 =====
export const getInventoryChecks = () => get('/inventory-checks')
export const getInventoryCheckById = (id: number) =>
  get(`/inventory-checks/${id}`)
export const createInventoryCheck = (data: { warehouse_id: number; operator?: string }) =>
  post('/inventory-checks', data)
export const scanInventoryCheck = (id: number, code: string, actual_qty?: number) =>
  post(`/inventory-checks/${id}/scan`, { code, actual_qty })
export const completeInventoryCheck = (id: number) =>
  post(`/inventory-checks/${id}/complete`)
