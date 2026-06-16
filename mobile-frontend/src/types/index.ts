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
