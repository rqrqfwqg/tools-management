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

// ===== 备件（旧：数量型 SparePart，向后兼容，逐步废弃） =====
export const getSpareParts = () => get('/spare-parts')
export const getSpareByCode = (code: string) =>
  get(`/spare-parts/code/${encodeURIComponent(code)}`)
export const borrowSpareByCode = (code: string, data?: { scene?: string; expected_return?: string; purpose?: string }) =>
  post(`/spare-parts/code/${encodeURIComponent(code)}/borrow`, data || {})
/** 备件即时领取：领走即扣库存，生成借出物料单（免审批） */
export const claimSpareParts = (items: Array<{ spare_id: number; qty: number }>) =>
  post('/spare-parts/claim', { items })


// =====================================================================
// 备件（新：序列化单品 spare_items，一对一码）—— 已对齐后端实现
// 设计：每件实物一个唯一 QR（item_code = SI-XXXXXXXX，8 位十六进制），
//       库存=实物件数，一个货位可放多件；盘点/扫码按单件。
// 后端已实现端点（materials.js）：
//   GET    /spare-items?keyword=&status=&warehouse_id=&category_id   列表（可过滤）
//   GET    /spare-items/code/:code                                   按码查单件
//   POST   /spare-items/batch   {spare_name,category_id,model,unit,warehouse_id,shelf_id,storage_location_id,status,count}  批量生成 N 件
//   PUT    /spare-items/:id     {storage_location_id,...}            改状态/位置/名称
//   DELETE /spare-items/:id
// 备注：后端暂未实现 借出/归还/报废 单件专属端点（materials.js 无 /code/:code/{borrow,return,scrap}）。
//       小程序侧 borrowSpareItem/returnSpareItem/scrapSpareItem 统一指向后端通用工单/库存接口占位，
//       实际借出走网页端或后端补端点；此处仅保留函数签名，调用处已做提示降级。
// =====================================================================
export const getSpareItems = (params?: {
  location_id?: number
  category_id?: number
  status?: string
  keyword?: string
}) => get('/spare-items', params)
export const getSpareItemByCode = (code: string) =>
  get(`/spare-items/code/${encodeURIComponent(code)}`)
export const createSpareItemBatch = (data: {
  spare_name: string
  category_id?: number
  model?: string
  unit?: string
  warehouse_id: number
  shelf_id?: number
  storage_location_id?: number
  status?: string
  count: number
}) => post('/spare-items/batch', data)
/**
 * 备件单品上架/入库：逐件扫码登记一件实物到目标货位（一对一码，货位可放多件）。
 * 对齐后端：PUT /spare-items/:id  { storage_location_id }（前端需先用 getSpareItemByCode 取 item_id）。
 */
export const updateSpareItem = (
  id: number,
  data: {
    spare_name?: string
    model?: string
    unit?: string
    warehouse_id?: number
    shelf_id?: number
    storage_location_id?: number
    status?: string
    category_id?: number
  }
) => put(`/spare-items/${id}`, data)
// 单件借出/归还/报废：后端暂未实现专属端点（materials.js 无 /code/:code/{borrow,return,scrap}）。
// 保留函数签名供购物车/扫码调用，调用方已降级提示；待后端补端点后再切换实现。
export const borrowSpareItem = (code: string) =>
  post(`/spare-items/code/${encodeURIComponent(code)}/borrow`, {})
export const returnSpareItem = (code: string) =>
  post(`/spare-items/code/${encodeURIComponent(code)}/return`, {})
export const scrapSpareItem = (code: string) =>
  post(`/spare-items/code/${encodeURIComponent(code)}/scrap`, {})


// ===== 消耗品（按 require_order 区分出库方式，已对齐后端实现） =====
// 后端 consumables 字段为 require_order（true=需工单 / false=免工单直领），GET 不支持 outbound_type 过滤，
// 因此前端的「需工单/免工单」筛选改为前端按 require_order 计算字段过滤（见 mapConsumable）。
// 出库端点：POST /consumables/code/:code/take （直领扣库存 + 写流水；需工单的会由后端拦截返回 400）。
// 备注：后端暂未实现 /borrow（需工单建单）端点，故需工单出库也走 /take，由后端 require_order 校验拦截。
export const getConsumables = (params?: { keyword?: string }) =>
  get('/consumables', params)
export const getConsumableByCode = (code: string) =>
  get(`/consumables/code/${encodeURIComponent(code)}`)
/**
 * 消耗品出库：对齐后端实现。
 * 后端 consumables 用 require_order 区分（true=需工单 / false=免工单），出库统一调 /take。
 * - 免工单（direct/require_order=false）：后端直接扣库存 + 写流水。
 * - 需工单（workorder/require_order=true）：后端 /take 会返回 400 拦截（提示走物料领用单）。
 * 备注：后端暂未实现 /borrow（需工单建单）端点，故前端 workorder 分支也调 /take，由后端校验拦截。
 */
export const outboundConsumable = (
  code: string,
  qty: number,
  outboundType: 'workorder' | 'direct'
) => post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty })
export const takeConsumableByCode = (code: string, qty: number) =>
  post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty })
export const getLowStockConsumables = () => get('/consumables/low-stock')

/**
 * 后端 consumables 用 require_order（布尔）表示出库方式，前端统一用 outbound_type 枚举。
 * 适配层：把后端记录映射为前端期望结构（outbound_type = require_order ? 'workorder' : 'direct'）。
 * 各页面/购物车统一调用本函数，避免散落 require_order 判断。
 */
export function mapConsumable(c: any): any {
  if (!c) return c
  const requireOrder = c.require_order === true || c.require_order === 'true' || c.require_order === 1
  return { ...c, outbound_type: requireOrder ? 'workorder' : 'direct' }
}

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
