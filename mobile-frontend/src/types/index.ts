export interface User {
  user_id: number
  username: string
  real_name: string
  phone: string
  role: string
  dept_id: number
  dept_name: string
  is_active: boolean
}

export interface Tool {
  tool_id: number
  tool_name: string
  tool_code: string
  category_name: string
  warehouse: string
  shelf: string
  location: string
  status: string
  description: string
  image_url: string
}

export interface Order {
  order_id: number
  order_no: string
  borrower_name: string
  borrower_phone: string
  warehouse: string
  status: string
  items: OrderItem[]
  created_at: string
  updated_at: string
}

export interface OrderItem {
  tool_id: number
  tool_name: string
  tool_code: string
  item_status: string
}

export interface DashboardStats {
  tools_total: number
  tools_available: number
  tools_borrowed: number
  tools_maintenance: number
  orders_pending: number
  orders_approved: number
  orders_returned: number
  users_total: number
}

export interface Warehouse {
  warehouse_id: number
  warehouse_name: string
  warehouse_code: string
  is_restricted: boolean
  is_active: boolean
}

export interface Category {
  category_id: number
  category_name: string
  category_code: string
}

export interface Dept {
  dept_id: number
  dept_name: string
}

export interface Shelf {
  shelf_id: number
  shelf_name: string
  shelf_code: string
  warehouse_id: number
  warehouse_name: string
  is_active: boolean
}

export interface Location {
  location_id: number
  location_name: string
  location_code: string
  shelf_id: number
  shelf_name: string
  warehouse_id: number
  is_active: boolean
}
