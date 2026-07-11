// 物料模块共享常量（v3.0.0 手机端增量）
// 集中管理 movement_type / item_type 中文映射、出入库前端筛选选项、标准底部 TabBar 文案。
// 任何页面展示流水/盘库类型都必须从此处取，禁止散落 hardcode。

/** 出入库流水 movement_type 中文映射（后端实际枚举仅 in/out/adjust） */
export const MOVEMENT_TYPE_TEXT: Record<string, string> = {
  in: '入库',
  out: '出库',
  adjust: '盘盈/盘亏'
}

/** 物料 item_type 中文映射 */
export const ITEM_TYPE_TEXT: Record<string, string> = {
  spare: '备件',
  consumable: '消耗品',
  tool: '工具'
}

/** 出入库前端筛选选项（后端 GET /stock-movements 不支持 movement_type 过滤，纯前端过滤） */
export interface StockFilterOption {
  key: string
  label: string
  /** 盘盈/盘亏由 adjust 的 qty 正负派生：qty>0 盘盈，qty<0 盘亏 */
  match: (m: { movement_type: string; qty: number }) => boolean
}

export const STOCK_FILTER_OPTIONS: StockFilterOption[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'in', label: '入库', match: (m) => m.movement_type === 'in' },
  { key: 'out', label: '出库', match: (m) => m.movement_type === 'out' },
  { key: 'profit', label: '盘盈', match: (m) => m.movement_type === 'adjust' && m.qty > 0 },
  { key: 'loss', label: '盘亏', match: (m) => m.movement_type === 'adjust' && m.qty < 0 }
]

/** 标准 5 项底部 TabBar 文案/图标/路由（物料高亮由 route 自动处理） */
export const MATERIAL_TABBAR: Array<{ text: string; icon: string; to: string }> = [
  { text: '首页', icon: 'home-o', to: '/dashboard' },
  { text: '工具', icon: 'orders-o', to: '/tools' },
  { text: '物料', icon: 'apps-o', to: '/material-center' },
  { text: '工单', icon: 'description', to: '/orders' },
  { text: '我的', icon: 'contact', to: '/profile' }
]
