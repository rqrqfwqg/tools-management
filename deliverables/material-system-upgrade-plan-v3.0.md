# 工器具管理系统 → 物料管理系统 升级规划

> 版本：v3.0.0 规划稿
> 日期：2026-07-11
> 编制：主理人 齐活林（交付总监）
> 状态：**待用户确认** — 确认后启动标准 SOP（PRD → 架构设计 → 工程实现 → QA）

---

## 一、升级目标

将现有「工器具管理系统 v2.0.0」升级为「物料管理系统 v3.0.0」：

1. **系统改名**：工器具管理系统 → 物料管理系统（PC 标题/Logo/登录页/移动端 Tab 全量替换）
2. **新增物料管理模块**：仿照工具管理的模块结构，新增物料管理
   - 物料分**备件**和**消耗品**两类，分别独立两张表
   - 备件需要领用申请（走工单审批，同工具流程）
   - 消耗品不需要申请（扫码直领，自动扣减库存）
3. **二维码全流程管理**：物料同样支持二维码，扫码出入库、盘库、领用
4. **角色权限沿用**：admin / staff / team_leader / material_manager 四角色功能不变
5. **工具管理精简**：现有工具管理降级为系统中的一个子模块，不新增功能、只保留维护

---

## 二、升级后系统架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────┐
│  接入层  PC端(Vue3+ElementPlus :3100)            │
│          移动端(Vue3+Vant4 :3200)                │
├─────────────────────────────────────────────────┤
│  业务模块层                                       │
│   ┌工具管理┐ ┌备件管理┐ ┌消耗品管理┐ ┌工单管理┐   │
│   │精简保留│ │新增·审批│ │新增·直领│ │扩展    │   │
│   └───────┘ └───────┘ └─────────┘ └───────┘   │
│   ┌仓库管理┐ ┌出入库  ┐ ┌盘库管理┐ ┌仪表盘  ┐   │
│   │共用    │ │新增·流水│ │新增·扫码│ │扩展    │   │
│   └───────┘ └───────┘ └───────┘ └───────┘   │
├─────────────────────────────────────────────────┤
│  基础服务层  认证/权限(JWT) · 扫码引擎 · 图片上传 │
├─────────────────────────────────────────────────┤
│  数据层  db.json (JSON 文件库)                    │
│          沿用11表 + 新增5表                       │
└─────────────────────────────────────────────────┘
```

### 2.2 模块变化清单

| 模块 | 变化类型 | 说明 |
|------|---------|------|
| 工具管理 | 🔻 精简 | 降级为子模块，仅保留现有 CRUD + 扫码，不再扩展 |
| 备件管理 | 🆕 新增 | 仿工具管理，走工单审批流程，有归还 |
| 消耗品管理 | 🆕 新增 | 扫码直领，扣库存，无工单无归还 |
| 工单管理 | 📈 扩展 | orders.items 增加 item_type 字段，支持工具/备件两类 |
| 仓库管理 | ➖ 共用 | warehouses/shelves/storage_locations 三表被工具+物料共用 |
| 出入库管理 | 🆕 新增 | 扫码出入库，写 stock_movements 流水 |
| 盘库管理 | 🆕 新增 | 扫码盘点，生成盘库单，记录差异 |
| 仪表盘 | 📈 扩展 | 增加物料统计卡片（备件总数/消耗品库存/低库存预警） |
| 用户/角色/部门 | ➖ 不变 | 4 角色权限完全沿用 |

---

## 三、新增数据模型（5 张表）

### 3.1 `spare_parts` 备件主表

| 字段 | 类型 | 说明 |
|------|------|------|
| spare_id | int | 主键 |
| spare_code | string | 备件编码（二维码内容，唯一） |
| spare_name | string | 备件名称 |
| category_id | int | 物料分类 ID（关联 material_categories） |
| warehouse_id | int | 仓库 ID |
| shelf_id | int | 货架 ID |
| storage_location_id | int | 库位 ID |
| stock_qty | int | 库存数量（备件按件管理，默认 1） |
| unit | string | 单位（件/套/台） |
| status | string | available / borrowed / maintenance |
| image_url | string | 图片 |
| description | string | 描述 |
| borrow_count | int | 领用次数 |
| created_at | string | 创建时间 |

### 3.2 `consumables` 消耗品主表

| 字段 | 类型 | 说明 |
|------|------|------|
| consumable_id | int | 主键 |
| consumable_code | string | 消耗品编码（二维码内容，唯一） |
| consumable_name | string | 消耗品名称 |
| category_id | int | 物料分类 ID |
| warehouse_id | int | 仓库 ID |
| shelf_id | int | 货架 ID |
| storage_location_id | int | 库位 ID |
| stock_qty | int | 当前库存数量 |
| unit | string | 单位（个/盒/卷/米） |
| warning_qty | int | 低库存预警阈值 |
| price | float | 单价（可选） |
| image_url | string | 图片 |
| description | string | 描述 |
| total_out | int | 累计出库数量 |
| created_at | string | 创建时间 |

### 3.3 `material_categories` 物料分类

| 字段 | 类型 | 说明 |
|------|------|------|
| category_id | int | 主键 |
| category_name | string | 分类名称 |
| category_code | string | 分类编码 |
| category_type | string | spare（备件）/ consumable（消耗品）/ both |
| description | string | 描述 |

> 注：物料分类独立于工具分类 `categories`，避免互相污染。

### 3.4 `stock_movements` 出入库流水

| 字段 | 类型 | 说明 |
|------|------|------|
| movement_id | int | 主键 |
| item_type | string | tool / spare / consumable |
| item_id | int | 关联工具/备件/消耗品 ID |
| item_code | string | 编码（冗余，便于查询） |
| item_name | string | 名称（冗余） |
| movement_type | string | in（入库）/ out（出库）/ adjust（盘库调整）/ return（归还入库） |
| qty | int | 数量（出库负、入库正，或单独存 +/-） |
| operator_id | int | 操作人 ID |
| operator_name | string | 操作人姓名 |
| order_id | int | 关联工单 ID（消耗品直领为 null） |
| scan_code | string | 扫码内容 |
| remark | string | 备注 |
| created_at | string | 时间 |

### 3.5 `inventory_checks` 盘库记录

| 字段 | 类型 | 说明 |
|------|------|------|
| check_id | int | 主键 |
| check_no | string | 盘库单号 |
| warehouse_id | int | 盘点仓库 |
| status | string | pending / completed |
| operator_id | int | 盘点人 ID |
| operator_name | string | 盘点人姓名 |
| items | array | 盘点明细：[{item_type, item_id, item_code, item_name, system_qty, actual_qty, diff}] |
| started_at | string | 开始时间 |
| completed_at | string | 完成时间 |

### 3.6 orders 表扩展

`orders.items[]` 每项增加字段：
- `item_type`: 'tool' | 'spare'（默认 tool，向后兼容）

---

## 四、新增接口规划

### 4.1 备件 `/api/spare-parts`（需 material_manager 增删改）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/spare-parts | 备件列表 |
| POST | /api/spare-parts | 新增备件 |
| PUT | /api/spare-parts/:id | 更新备件 |
| DELETE | /api/spare-parts/:id | 删除备件 |
| GET | /api/spare-parts/code/:code | 扫码按编码查备件 |
| POST | /api/spare-parts/code/:code/borrow | 扫码领用备件（生成工单 pending） |
| POST | /api/spare-parts/:id/upload-image | 上传图片 |

### 4.2 消耗品 `/api/consumables`（需 material_manager 增删改）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/consumables | 消耗品列表 |
| POST | /api/consumables | 新增消耗品 |
| PUT | /api/consumables/:id | 更新消耗品 |
| DELETE | /api/consumables/:id | 删除消耗品 |
| GET | /api/consumables/code/:code | 扫码按编码查消耗品 |
| POST | /api/consumables/code/:code/take | 扫码直领（扣库存 + 写流水，无工单） |
| POST | /api/consumables/:id/upload-image | 上传图片 |
| GET | /api/consumables/low-stock | 低库存预警列表 |

### 4.3 物料分类 `/api/material-categories`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/material-categories | 分类列表 |
| POST/PUT/DELETE | /api/material-categories[/:id] | 增删改（需 material_manager） |

### 4.4 出入库流水 `/api/stock-movements`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stock-movements | 流水列表（支持筛选 item_type/时间/操作人） |
| POST | /api/stock-movements | 手动入库/出库登记 |

### 4.5 盘库 `/api/inventory-checks`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/inventory-checks | 盘库记录列表 |
| POST | /api/inventory-checks | 新建盘库单 |
| GET | /api/inventory-checks/:id | 盘库单详情 |
| POST | /api/inventory-checks/:id/scan | 扫码盘点提交实际数量 |
| POST | /api/inventory-checks/:id/complete | 完成盘库（写调整流水） |

---

## 五、前端模块规划

### 5.1 PC 端新增页面（vue-frontend/src/views）

| 页面文件 | 路由 | 说明 |
|---------|------|------|
| SparePartManagement.vue | /spare-parts | 备件管理（仿 ToolManagement） |
| ConsumableManagement.vue | /consumables | 消耗品管理（含库存预警标识） |
| MaterialCategoryManagement.vue | /material-categories | 物料分类管理 |
| StockMovement.vue | /stock-movements | 出入库流水查询 |
| InventoryCheck.vue | /inventory-checks | 盘库管理 |
| BarcodeList.vue | /barcodes | 扩展：支持工具/备件/消耗品三种条码打印 |

侧边栏菜单重组：
- 仪表盘
- **物料管理**（分组）
  - 备件管理
  - 消耗品管理
  - 物料分类
  - 出入库流水
  - 盘库管理
- **工具管理**（分组，精简）
  - 工具列表
  - 工具箱
  - 工具分类
- **工单管理**
  - 领用工单
- **系统管理**
  - 用户/部门/角色/仓库/货架/库位
- 条码打印

### 5.2 移动端新增页面（mobile-frontend/src/views）

| 页面文件 | 路由 | 说明 |
|---------|------|------|
| SparePartManagement.vue | /spare-parts | 备件列表（仿 ToolManagement） |
| ConsumableManagement.vue | /consumables | 消耗品列表 + 直领 |
| ScanTool.vue | /scan | 扫码引擎扩展：识别工具/备件/消耗品/工具箱 4 种编码 |

扫码识别规则（编码前缀）：
- `G-` → 工具（tool_code）
- `BJ-` → 备件（spare_code）
- `XH-` → 消耗品（consumable_code）
- `BX-` → 工具箱（toolkit_code）

移动端 TabBar 调整：首页 / 物料 / 工单 / 扫码 / 我的（5 Tab 或保留 4 Tab + 物料入口在首页）

---

## 六、版本路线

### v3.0.0 — 架构升级 + 物料核心模块（本次主版本）

**范围**：
- 系统全量改名（工器具 → 物料管理）
- 后端新增 5 张表 + 5 个路由模块
- 备件管理（CRUD + 扫码 + 工单审批）
- 消耗品管理（CRUD + 扫码直领 + 库存扣减）
- 出入库流水
- 盘库管理（扫码盘点）
- 工单扩展支持备件
- PC 端 6 个新页面 + 菜单重组
- 移动端 2 个新页面 + 扫码引擎扩展
- 仪表盘扩展物料统计

**工作量预估**：标准 SOP 全流程，约 3-4 个工作日（团队并行）

### v3.1.0 — 补丁版本（顺带修复历史遗留）

- 补回丢失的弱光扫码优化（torch 闪光灯 + 原生 BarcodeDetector）
- 补回丢失的工具箱条形码接口 `GET /api/toolkits/code/:code`
- 消耗品低库存预警通知

### v3.2.0 — 增强版本（按需迭代）

- 物料出入库报表导出（Excel）
- 盘库差异报告
- 消耗品价格统计 / 月度消耗分析
- 备件寿命跟踪（可选）

---

## 七、待用户确认事项

在正式启动标准 SOP 之前，请确认以下几点：

1. **物料分类**：备件和消耗品是否需要共用一套分类，还是完全独立两套？（当前规划：共用 `material_categories`，用 `category_type` 区分）
2. **备件是否按件管理**：备件是否像工具一样「一物一码」（每个备件独立编码、独立状态），还是按品类管理库存数量？（当前规划：一物一码，stock_qty 默认 1，与工具一致）
3. **消耗品扫码领用是否需要数量确认**：扫码后是固定扣 1，还是弹窗输入数量？（当前规划：弹窗输入数量）
4. **盘库范围**：盘库是按仓库全量盘点，还是支持按货架/分类局部盘点？（当前规划：按仓库，扫码逐件盘点）
5. **工具管理精简程度**：工具管理「精简为子模块」是指只保留现有功能不新增，还是要砍掉部分功能（如工具箱）？（当前规划：仅不新增，现有功能全保留）
6. **历史数据迁移**：现有 tools 表数据是否需要迁移到物料体系，还是保持独立？（当前规划：保持独立，工具和物料并行存在）
7. **是否需要我先去服务器 `/opt/tools-management` 核对线上版本**，确认线上是否有弱光优化/工具箱条形码的旧代码可找回？（影响 v3.1.0 的工作量）

---

## 八、建议工作流

确认上述事项后，按**标准 SOP** 推进：

```
产品经理(许清楚) → 增量PRD
    ↓
架构师(高见远) → 增量架构设计 + 任务分解
    ↓
工程师(寇豆码) → 后端5模块 + PC 6页面 + 移动端2页面 + 扫码扩展
    ↓
QA工程师(严过关) → 接口测试 + 扫码流程回归 + 工单兼容性测试
```

预估涉及 **20+ 文件新增/修改**，属于中大型需求，必须走标准 SOP。
