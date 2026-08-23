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
// 备件（新：序列化单品 spare_items，一对一码）—— 需后端实现
// 设计：每件实物一个唯一 QR（spare_code = SP-<id>），库存=实物件数，
//       一个货位可放多件；盘点/扫码按单件。
// 后端需提供端点：
//   GET    /spare-items?location_id=&category_id=&status=&keyword=   列表（可过滤）
//   GET    /spare-items/code/:code                                   按码查单件
//   GET    /spare-items/by-location/:locationId                      某货位下全部单件（按货位聚合用）
//   POST   /spare-items                                              登记新单件（生成 SP- 码）
//   POST   /spare-items/code/:code/borrow   {scene?,expected_return?,purpose?}  单件借出
//   POST   /spare-items/code/:code/return                             单件归还
//   POST   /spare-items/code/:code/scrap                             单件报废
// =====================================================================
export const getSpareItems = (params?: {
  location_id?: number
  category_id?: number
  status?: string
  keyword?: string
}) => get('/spare-items', params)
export const getSpareItemByCode = (code: string) =>
  get(`/spare-items/code/${encodeURIComponent(code)}`)
export const getSpareItemsByLocation = (locationId: number) =>
  get(`/spare-items/by-location/${locationId}`)
export const createSpareItem = (data: {
  spare_name: string
  category_id?: number
  storage_location_id: number
  unit?: string
  description?: string
}) => post('/spare-items', data)
export const borrowSpareItem = (
  code: string,
  data?: { scene?: string; expected_return?: string; purpose?: string }
) => post(`/spare-items/code/${encodeURIComponent(code)}/borrow`, data || {})
export const returnSpareItem = (code: string) =>
  post(`/spare-items/code/${encodeURIComponent(code)}/return`, {})
export const scrapSpareItem = (code: string) =>
  post(`/spare-items/code/${encodeURIComponent(code)}/scrap`, {})


// ===== 消耗品（新增 outbound_type 过滤与按类型出库） =====
export const getConsumables = (params?: { outbound_type?: 'workorder' | 'direct'; keyword?: string }) =>
  get('/consumables', params)
export const getConsumableByCode = (code: string) =>
  get(`/consumables/code/${encodeURIComponent(code)}`)
/**
 * 消耗品出库：按 outbound_type 分流
 * - direct（免工单）：直领扣库存，不建工单  → 后端 POST /consumables/code/:code/take
 * - workorder（需工单）：建工单扣库存        → 后端 POST /consumables/code/:code/borrow（生成 order, status=pending）
 * 备注：当前后端仅实现了 /take（直领）。需工单分支端点 /borrow 待后端实现。
 */
export const outboundConsumable = (
  code: string,
  qty: number,
  outboundType: 'workorder' | 'direct'
) =>
  outboundType === 'direct'
    ? post(`/consumables/code/${encodeURIComponent(code)}/take`, { qty })
    : post(`/consumables/code/${encodeURIComponent(code)}/borrow`, { qty })
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
