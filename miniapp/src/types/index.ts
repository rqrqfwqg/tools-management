// ========== 基础类型定义（与 PC 端保持兼容） ==========

export interface User {
  user_id: number
  username: string
  real_name: string
  dept_id: number
  role: string
  role_id: number
  role_name: string
  is_active: boolean
  phone?: string
  dept_name?: string
  // ===== 微信登录扩展字段（设计文档 §4.3，追加可选字段，保持 H5 端兼容） =====
  wx_openid?: string | null
  wx_nickname?: string
  wx_avatar?: string
}

/** 微信登录结果（与 /auth/login 同构 + is_new_user） */
export interface WxLoginResult {
  access_token: string
  user: User
  is_new_user?: boolean
}

export interface Tool {
  tool_id: number
  tool_code: string
  tool_name: string
  category_id: number
  category_name: string
  scene?: string
  warehouse?: string
  warehouse_id?: number
  shelf_id?: number
  shelf_name?: string
  storage_location_id?: number
  storage_location?: string
  location_name?: string
  status: string
  purchase_date?: string
  scrap_date?: string
  borrow_count?: number
  description?: string
  image_url?: string
  toolkit_name?: string
}

export interface Warehouse {
  warehouse_id: number
  warehouse_name: string
  warehouse_code: string
  description?: string
  is_active: boolean
}

export interface Category {
  category_id: number
  category_name: string
  category_code: string
  description: string
  require_approval?: boolean
}

export interface OrderItem {
  item_id: number
  tool_id: number
  tool_code: string
  tool_name: string
  item_status: string
  return_time?: string
  condition_note?: string
}

export interface Order {
  order_id: number
  order_no: string
  borrower_name: string
  status: string
  scene?: string
  warehouse?: string
  require_approval: boolean
  borrow_time: string
  expected_return?: string
  actual_return?: string
  purpose?: string
  created_at: string
  items?: OrderItem[]
}

// ========== 扫码相关 ==========

export interface ScanRecord {
  /** 扫码时间 ISO 字符串 */
  scanned_at: string
  /** 工具编码 */
  tool_code: string
  /** 工具名称 */
  tool_name: string
  /** 工具ID */
  tool_id: number
  /** 扫码时状态 */
  status: string
}

// ========== 物料管理（与 PC 端 types 对齐） ==========

export interface SparePart {
  spare_id: number
  spare_code: string
  spare_name: string
  category_id?: number
  category_name?: string
  warehouse_id?: number
  warehouse_name?: string
  shelf_id?: number
  shelf_name?: string
  storage_location_id?: number
  location_name?: string
  storage_location?: string
  stock_qty?: number
  unit?: string
  status: string
  image_url?: string
  description?: string
  borrow_count?: number
  /** 预警值（后端 enrichSpare 已返回） */
  warning_qty?: number | null
  /** 单条低库存标记（后端 enrichSpare 已返回，按条比较 stock_qty<=warning_qty） */
  is_low_stock?: boolean
  created_at?: string
}

export interface Consumable {
  consumable_id: number
  consumable_code: string
  consumable_name: string
  category_id?: number
  category_name?: string
  warehouse_id?: number
  warehouse_name?: string
  shelf_id?: number
  shelf_name?: string
  storage_location_id?: number
  location_name?: string
  storage_location?: string
  stock_qty: number
  unit?: string
  warning_qty?: number | null
  price?: number | null
  image_url?: string
  description?: string
  total_out?: number
  created_at?: string
}

export interface MaterialCategory {
  category_id: number
  category_name: string
  category_code: string
  category_type: 'spare' | 'consumable' | 'both'
  description: string
}

export interface StockMovement {
  movement_id: number
  item_type: string
  item_id?: number
  item_code?: string
  item_name?: string
  movement_type: string
  qty: number
  operator_id?: number
  operator_name?: string
  order_id?: number | null
  scan_code?: string
  remark?: string
  created_at?: string
}

export interface InventoryCheckItem {
  item_type: 'spare' | 'consumable' | 'tool'
  item_id: number
  item_code: string
  item_name: string
  system_qty: number
  actual_qty: number
  diff: number
  /** 前端瞬时"已录入"标记（不持久化到后端，由 useInventoryEntered 统一维护） */
  entered?: boolean
}

export interface InventoryCheck {
  check_id: number
  check_no: string
  warehouse_id: number
  warehouse_name?: string
  status: string
  operator_id?: number
  operator_name?: string
  items?: InventoryCheckItem[]
  started_at?: string
  completed_at?: string
}
