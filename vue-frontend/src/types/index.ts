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
