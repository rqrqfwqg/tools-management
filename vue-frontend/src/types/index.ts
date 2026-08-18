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

export interface Dept {
  dept_id: number
  dept_name: string
  dept_code: string
  description: string
}

export interface Category {
  category_id: number
  category_name: string
  category_code: string
  description: string
  require_approval?: boolean
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
  toolkit_name?: string
  toolkit_seq?: number
  status: string
  purchase_date?: string
  scrap_date?: string
  borrow_count?: number
  description?: string
  image_url?: string
  // 盘亏复核（inventory_missing* 标记由盘库 complete 打标、PC 端复核确认/撤销）
  inventory_missing?: boolean
  inventory_missing_at?: string
  inventory_missing_check_no?: string
  inventory_missing_confirmed?: boolean
  inventory_missing_confirmed_at?: string
}

export interface ReturnRecord {
  return_id: number
  item_id?: number
  spare_id?: number
  tool_id?: number
  return_qty: number
  returned_at: string
  returned_by?: string
  remark?: string
}

export interface OrderItem {
  item_id: number
  tool_id?: number
  tool_code?: string
  tool_name?: string
  item_type?: string
  spare_id?: number
  spare_code?: string
  spare_name?: string
  item_status: string
  return_time?: string
  condition_note?: string
  // 物料数量语义（T01 新增）
  borrow_qty?: number
  returned_qty?: number
  return_records?: ReturnRecord[]
  last_use_qty?: number
  checked?: boolean
  checked_at?: string
  checked_by?: string
}

export interface Order {
  order_id: number
  order_no: string
  borrower_name: string
  status: string
  order_type?: 'tool' | 'material'
  closed?: boolean
  closed_at?: string
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
  model?: string
  warning_qty?: number | null
  is_low_stock?: boolean
  model_available_count?: number | null
  model_warning_qty?: number | null
  unit?: string
  status: string
  image_url?: string
  description?: string
  borrow_count?: number
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

export interface Role {
  role_id: number
  role_name: string
  role_code: string
  description: string | null
  is_system: boolean
  permission_ids: number[]
  user_count?: number
}

export interface DashboardStats {
  tools_total: number
  tools_available: number
  tools_borrowed: number
  tools_maintenance: number
  tools_scrapped: number
  spare_total: number
  spare_available: number
  spare_borrowed: number
  consumable_total: number
  consumable_total_qty: number
  consumable_low_stock: number
  orders_total: number
  orders_pending: number
  orders_approved: number
  orders_returned: number
  orders_borrowed: number
  orders_overdue: number
  users_total: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

// 安全防护用品
export interface SafetySupply {
  supply_id: number
  name: string
  model?: string
  brand?: string
  production_date?: string
  expiry_date: string
  manager: string
  user_name?: string
  check_cycle_days?: number
  last_check_date?: string | null
  remark?: string
  created_at?: string
  updated_at?: string
}

// 安全防护用品提醒数据
export interface SafetySupplyAlerts {
  expiry_alert_days: number
  expiring: Array<SafetySupply & { days_to_expiry: number }>
  check_due: Array<SafetySupply & { next_check_date: string | null }>
}
