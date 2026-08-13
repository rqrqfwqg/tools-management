/**
 * API 层（小程序适配版）
 * 自 mobile-frontend/src/api/index.ts 拷贝并适配：
 * - axios 实例 → utils/request.ts（request/get/post/put/del）
 * - 后端裸 JSON 响应：request 已 resolve 业务数据，函数直接返回
 * - 新增 wxLogin()（POST /auth/wx-login）
 * - uploadToolImage：FormData 不可用于小程序，改为 uni.uploadFile
 */
import { get, post, put, del } from '@/utils/request'
import { getToken } from '@/utils/storage'
import type { WxLoginResult } from '@/types'

// ===== Auth =====
export const login = (phone: string) => post('/auth/login', { phone })

/** 微信一键登录：code 由 uni.login 获取，nickname/avatar 选填（首次建档用） */
export const wxLogin = (code: string, nickname?: string, avatar?: string) =>
  post<WxLoginResult>('/auth/wx-login', { code, nickname, avatar })

/**
 * 微信绑定手机号：把当前微信账号关联到已有手机号账户（同名员工档案合并）。
 * 有匹配账户→合并（临时微信账号被移除，返回目标 user）；无匹配→给当前账号补手机号。
 * 注意：合并后旧 token 失效（临时账号已删），调用方需重新 wx-login 换新 token。
 */
export const wxBindPhone = (phone: string) => post('/auth/wx-bind-phone', { phone })

// ===== 通知 / 提醒 =====
/** 获取订阅消息配置状态（前端展示模板是否配置、下次推送时间） */
export const getNotifyConfig = () => get('/notifications/config')
/** 给当前用户发送一条「未归还提醒」测试（验证模板是否生效，无需等待 8/20） */
export const sendTestReminder = () => post('/notifications/test-reminder')

/**
 * 微信手机号登录：phoneCode 来自 <button open-type="getPhoneNumber"> 的 e.detail.code，
 * code 来自 uni.login。后端解析手机号匹配系统账号决定权限；未匹配返回游客（只读）。
 */
export const wxPhoneLogin = (code: string, phoneCode: string) =>
  post('/auth/wx-phone-login', { code, phoneCode })

// ===== Users =====
export const getUsers = () => get('/users')
export const createUser = (data: any) => post('/users', data)
export const updateUser = (id: number, data: any) => put(`/users/${id}`, data)
export const deleteUser = (id: number) => del(`/users/${id}`)
export const resetPassword = (id: number, password: string) =>
  put(`/users/${id}/reset-password`, { password })

// ===== Tools =====
export const getTools = () => get('/tools')
export const getToolkits = () => get('/toolkits')
export const getToolkitDetail = (id: number) => get(`/toolkits/${id}`)
export const createTool = (data: any) => post('/tools', data)
export const updateTool = (id: number, data: any) => put(`/tools/${id}`, data)
export const deleteTool = (id: number) => del(`/tools/${id}`)

// ===== Orders =====
export const getOrders = () => get('/orders')
export const createOrder = (data: any) => post('/orders', data)
export const updateOrderStatus = (id: number, status: string) =>
  put(`/orders/${id}/status`, { status })
export const returnOrder = (id: number, returns?: Array<{ spare_id?: number; item_id?: number; return_qty: number }>) =>
  post(`/orders/${id}/return`, returns ? { returns } : {})

// ===== Checklist — 现场清点 =====
export const getChecklist = (orderId: number) => get(`/orders/${orderId}/checklist`)
export const saveChecklistItem = (orderId: number, toolId: number, checked: boolean) =>
  post(`/orders/${orderId}/checklist`, { tool_id: toolId, checked })

// ===== Warehouses =====
export const getWarehouses = () => get('/warehouses')
export const createWarehouse = (data: any) => post('/warehouses', data)
export const updateWarehouse = (id: number, data: any) => put(`/warehouses/${id}`, data)
export const deleteWarehouse = (id: number) => del(`/warehouses/${id}`)

// ===== Categories =====
export const getCategories = () => get('/tool-categories')
export const createCategory = (data: any) => post('/tool-categories', data)
export const updateCategory = (id: number, data: any) => put(`/tool-categories/${id}`, data)
export const deleteCategory = (id: number) => del(`/tool-categories/${id}`)

// ===== Depts =====
export const getDepts = () => get('/departments')
export const createDept = (data: any) => post('/departments', data)
export const updateDept = (id: number, data: any) => put(`/departments/${id}`, data)
export const deleteDept = (id: number) => del(`/departments/${id}`)

// ===== Shelves =====
export const getShelves = () => get('/shelves')
export const createShelf = (data: any) => post('/shelves', data)
export const updateShelf = (id: number, data: any) => put(`/shelves/${id}`, data)
export const deleteShelf = (id: number) => del(`/shelves/${id}`)

// ===== Locations =====
export const getLocations = () => get('/storage-locations')
export const createLocation = (data: any) => post('/storage-locations', data)
export const updateLocation = (id: number, data: any) => put(`/storage-locations/${id}`, data)
export const deleteLocation = (id: number) => del(`/storage-locations/${id}`)

// ===== Roles =====
export const getRoles = () => get('/roles')

// ===== Dashboard =====
export const getDashboardStats = () => get('/dashboard')

/**
 * 上传工具图片（需要 token 鉴权 + material_manager 角色）
 * 小程序适配：原 H5 版接收 FormData，小程序改用 uni.uploadFile（filePath）
 * 签名调整为 (toolId, filePath)；P2 优先级，UI 暂缓接入。
 */
export const uploadToolImage = (toolId: number, filePath: string) =>
  new Promise<any>((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/tools/${toolId}/upload-image`,
      filePath,
      name: 'image',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data)
          } else {
            reject({ statusCode: res.statusCode, message: data?.message || '上传失败', data })
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, message: '上传响应解析失败', data: res.data })
        }
      },
      fail: (err) => reject({ statusCode: 0, message: err.errMsg || '上传失败', data: err })
    })
  })

// ===== Scan — 按 tool_code 查询工具 =====
export const getToolByCode = (code: string) =>
  get(`/tools/code/${encodeURIComponent(code)}`)

// ===== Scan — 按 toolkit_code 查询工具箱详情（含内部工具列表） =====
export const getToolkitByCode = (code: string) =>
  get(`/toolkits/code/${encodeURIComponent(code)}`)

// ===== Scan — 按 tool_code 快速领用（单件工具） =====
export const borrowToolByCode = (code: string, data?: { scene?: string; expected_return?: string; purpose?: string }) =>
  post(`/tools/code/${encodeURIComponent(code)}/borrow`, data || {})
