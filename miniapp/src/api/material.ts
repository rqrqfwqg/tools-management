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
/** 备件即时领取：领走即扣库存，生成借出物料单（免审批） */
export const claimSpareParts = (items: Array<{ spare_id: number; qty: number }>) =>
  post('/spare-parts/claim', { items })


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
// resolve-only：扫货位码/物料码，仅解析返回物料+系统库存（不写入实盘）
export const resolveInventoryCheck = (id: number, code: string) =>
  post(`/inventory-checks/${id}/scan`, { code })
export const completeInventoryCheck = (id: number) =>
  post(`/inventory-checks/${id}/complete`)

// 入库单模块
export const createInboundOrder = (data: any) => post('/inbound-orders', data)
export const getInboundOrders = (params?: any) => get('/inbound-orders', params)
export const receiveInboundOrder = (id: number, data?: any) =>
  post(`/inbound-orders/${id}/receive`, data || {})
export const resolveInboundLocation = (code: string) =>
  post('/inbound-orders/resolve-location', { code })
