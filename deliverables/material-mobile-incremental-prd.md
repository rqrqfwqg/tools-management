# 物料管理系统 v3.0.0 — 手机端物料功能增量 PRD（简单版）

> 产品经理：许清楚（software-product-manager）｜ 文档类型：增量 PRD（简单版，无竞品分析）｜ 日期：2026-07-11

## 1. 项目信息

| 项 | 内容 |
| --- | --- |
| 语言 | 中文 |
| 技术栈 | Vue 3 + Vant 4 + TypeScript + Pinia + Vue Router（沿用现有 `mobile-frontend`） |
| 项目名称 | `material_mobile_incremental` |
| 关联版本 | 工器具管理系统 → 物料管理系统 v3.0.0（后端已上线，本次手机端增量） |
| 原始需求复述 | 在已上线的 v3.0.0 手机端上，**增量补全缺失的物料功能**：① 盘点页（新建）；② 出入库流水页（新建）；③ 不依赖扫码的独立物料领用页（新建，复用扫码领用逻辑）；④ 新增「物料」底部 Tab 聚合四个子功能。后端接口与手机端 API/类型层均已就绪，**零后端改动**。 |

## 2. 产品目标

**在不改动后端与前序模块的前提下，为仓管/班组长/物料管理员补齐手机端的「盘点、出入库查看、免扫码独立领用」三大物料闭环能力，并通过新增「物料」Tab 将既有备件/消耗品入口与新增功能统一聚合，实现工具模块零回归。**

## 3. 用户故事

| # | 角色 | 故事 | 价值 |
| --- | --- | --- | --- |
| US-1 | 仓管员 | 作为仓管员，我想在手机端选择仓库并创建盘库单，逐项扫码/录入实点数（备件在位/缺失、消耗品实数），最后一键完成盘库，以便现场快速盘点。 | 移动盘点闭环 |
| US-2 | 仓管员 | 作为仓管员，我想在盘点录入时按编码解析出物料并录入 `actual_qty`，以便区分备件（0/1）与消耗品（实数）的盘点语义。 | 语义正确 |
| US-3 | 班组长 | 作为班组长，我想在手机端查看出入库流水列表，并按类型（入库/出库/盘盈/盘亏等）筛选，以便追溯物料动向。 | 流水可查 |
| US-4 | 物料管理员 | 作为物料管理员，我想在手机端浏览备件/消耗品列表并进入详情后一键领用（备件生成工单、消耗品输数量直领），且不依赖扫码，以便无码或代领场景也能操作。 | 免扫码领用 |
| US-5 | 物料管理员 | 作为物料管理员，我希望独立领用页复用扫码弹窗已有的 borrow/take 逻辑，以免重复开发与逻辑分叉。 | 单一逻辑源 |
| US-6 | 仓管员 | 作为仓管员，我想在底部导航看到「物料」入口，点进去是物料中心，快速跳到备件/消耗品/盘点/出入库，以免功能散落。 | 入口聚合 |
| US-7 | 班组长 | 作为班组长，我希望盘点完成后能看到差异汇总（差异项高亮），以便快速识别盈亏。 | 差异可视（P1） |
| US-8 | 物料管理员 | 作为物料管理员，我希望消耗品低库存有提醒，以便及时补货。 | 预警（P1） |

## 4. 需求池

### P0 — 必做（本次增量核心）

| ID | 需求 | 说明 / 验收标准 |
| --- | --- | --- |
| P0-1 | 物料中心页 | 路由建议 `/material-center`；4 个 tile（备件 / 消耗品 / 盘点 / 出入库）跳转；备件→`/spare-parts`、消耗品→`/consumables`、盘点→`/inventory`、出入库→`/stock-movements`。 |
| P0-2 | 盘点页（新建 `/inventory`） | 三态流程：① 选仓库（`getWarehouses`）→ ② `createInventoryCheck({warehouse_id, operator})` 创建盘库单 → ③ 逐项扫码/录入 `actual_qty`（备件开关 0/1、消耗品数字）→ `scanInventoryCheck(id, code, actual_qty?)` → ④ `completeInventoryCheck(id)` 完成。 |
| P0-3 | 出入库页（新建 `/stock-movements`） | `getStockMovements(params?)` 列表展示；支持按 `movement_type` 筛选（入库/出库/盘盈/盘亏/其他）；下拉刷新、空态、加载态。 |
| P0-4 | 独立物料领用页（新建 `/material-dispense`） | 列表浏览备件/消耗品（复用 `getSpareParts` / `getConsumables`），进入详情后一键领用；**领用动作复用 `ScanResultPopup` 的 `borrowSpareByCode` / `takeConsumableByCode` 逻辑**，不重复实现。 |
| P0-5 | 「物料」底部 Tab 聚合 | 在现有底部 `van-tabbar` 增加「物料」入口 → `/material-center`；保持既有 首页/工具/工单/我的 不变，工具扫码逻辑（`ScanTool` 前缀分发）零改动。 |
| P0-6 | 零新增后端依赖 | 全部调用既有接口（`@/api/material` 与 `@/api` 的 `getWarehouses`），不新增/不改后端路由。 |

### P1 — 应有（提升体验，本迭代尽量做）

| ID | 需求 | 说明 |
| --- | --- | --- |
| P1-1 | 盘点差异高亮 | 完成盘库后展示 `items` 中 `diff != 0` 的项，红/绿标记盘亏/盘盈。 |
| P1-2 | 消耗品低库存提醒 | 独立领用页/消耗品列表对 `stock_qty <= warning_qty` 显示「库存预警」标签（类型已含 `warning_qty`）。 |
| P1-3 | 盘点进度反馈 | 三态页顶部展示「已录入 N 项 / 当前盘库单号」，录入后即时 Toast 并本地累加计数。 |
| P1-4 | 出入库类型中文映射 | `movement_type` 枚举→中文（入库/出库/盘盈/盘亏/调拨/其他），`item_type` 标注（备件/消耗品/工具）。 |

### P2 — 可选（后续迭代）

| ID | 需求 | 说明 |
| --- | --- | --- |
| P2-1 | 盘点/出入库数据导出 | 导出 Excel/CSV（需评估是否纯前端或复用后端导出）。 |
| P2-2 | 角色权限控制 | 按 `role`（如 `material_manager`）限制盘点创建/出入库查看权限（见待确认 Q5）。 |
| P2-3 | TabBar 组件化重构 | 将各页重复的 `van-tabbar` 抽为公共 `<AppTabBar>`，消除重复（技术债，不影响本需求）。 |
| P2-4 | 既有列表领用逻辑收敛 | `SparePartList`/`ConsumableList` 内联的 borrow/take 逻辑统一改为引用 `ScanResultPopup`，消除与弹窗的逻辑分叉。 |

## 5. UI 设计稿（文字 + 结构描述）

### 5.1 物料中心页 `/material-center`（4 tile）

```
┌─────────────────────────────┐
│  nav-bar: 物料中心           │
├─────────────────────────────┤
│  ┌──────────┐ ┌──────────┐  │
│  │ 🔩 备件   │ │ 📦 消耗品 │  │  tile（van-grid 2列）
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │ 📋 盘点   │ │ 🔄 出入库 │  │
│  └──────────┘ └──────────┘  │
├─────────────────────────────┤
│  tabbar: 首页 工具 物料 工单 我的 │  ← 新增「物料」高亮
└─────────────────────────────┘
```
- 4 个 `van-grid-item` 点击分别 `router.push` 到对应路由。
- 该页自身不含业务数据，仅聚合入口。

### 5.2 盘点页 `/inventory`（创建 → 扫描录入 → 完成 三态）

**态1 · 创建盘库单**
```
┌─────────────────────────────┐
│  nav-bar: 盘点               │
│  [选择仓库 ▾]  ← getWarehouses│
│  [开始盘点]  primary 按钮     │
└─────────────────────────────┘
```
- 仓库用 `van-dropdown` / `van-picker` 选择；确认后调 `createInventoryCheck({warehouse_id, operator})`，拿到 `check_id` / `check_no` 进入态2。

**态2 · 扫描录入（逐项）**
```
┌─────────────────────────────┐
│  盘库单号：PD-20260711-001    │
│  已录入 12 项                 │
│  ┌───────────────────────┐  │
│  │ [扫码/输入编码]        │  │  ← 调 ScanTool 或手动输入
│  └───────────────────────┘  │
│  解析结果：名称 / 系统数      │
│  备件：[在位 ●] [缺失 ○]     │  ← actual_qty 0/1 开关
│  消耗品：[实点数  ____ ]      │  ← 数字输入
│  [提交本项]                  │  → scanInventoryCheck
└─────────────────────────────┘
```
- 编码解析：优先调 `ScanTool` 引擎；`BJ-`→备件、`XH-`→消耗品 走既有分发；也可手动输入后本地按前缀/调用 `getSpareByCode`/`getConsumableByCode` 解析。
- `actual_qty` 录入规则：备件用 `van-switch`（在位=1/缺失=0），消耗品用 `van-field type=digit`（实数）。提交即调 `scanInventoryCheck(id, code, actual_qty)`。

**态3 · 完成盘库**
```
┌─────────────────────────────┐
│  盘库完成！                  │
│  合计 N 项 ｜ 差异 M 项 (P1) │
│  差异项列表（高亮，P1）：     │
│   螺栓 M8  系统10 实点8 亏2   │
│  [返回物料中心]              │
└─────────────────────────────┘
```
- 调 `completeInventoryCheck(id)`；若后端返回 `items`，按 `diff` 渲染差异（P1）。

### 5.3 出入库页 `/stock-movements`（筛选 + 列表）

```
┌─────────────────────────────┐
│  nav-bar: 出入库             │
│  [全部▾][入库][出库][盘盈][盘亏]│  ← movement_type 筛选
│  ┌───────────────────────┐  │
│  │ 2026-07-11 入库 螺栓x10│  │  van-cell 列表
│  │ 2026-07-10 出库 扎带x5 │  │
│  └───────────────────────┘  │
│  (下拉刷新 / 空态)           │
└─────────────────────────────┘
```
- 调 `getStockMovements({ movement_type })`，筛选条件映射中文；列表展示 `created_at / movement_type(中文) / item_name / qty / operator_name`。

### 5.4 独立领用页 `/material-dispense` 与 物料详情页

**列表（顶部 Tab 切换 备件 / 消耗品）**
```
┌─────────────────────────────┐
│  nav-bar: 物料领用           │
│  [备件 | 消耗品]  ← van-tabs  │
│  🔍 搜索名称/编码             │
│  列表卡片（同既有 SparePartList/
│  ConsumableList 样式）        │
│  → 点击进详情                 │
└─────────────────────────────┘
```

**详情（领用按钮区）— 复用 `ScanResultPopup`**
```
┌─────────────────────────────┐
│  (底部弹窗 ScanResultPopup)  │
│   图片 / 名称 / 编码 / 仓库   │
│   备件 → [扫码领用(生成工单)] │  ← handleBorrowSpare
│   消耗品 → [数量输入]+[确认直领]│ ← handleTakeConsumable
└─────────────────────────────┘
```
- **关键复用**：详情直接用 `<ScanResultPopup :spare="..." / :consumable="..." :show="true" />`，领用逻辑全部来自该组件，本页不重写 borrow/take。
- 备件领用成功后提示「工单号：xxx」；消耗品校验数量并扣减库存，成功后 Toast。

## 6. 待确认问题（需用户 / 架构师拍板）

1. **盘点 `actual_qty` 录入方式**：备件是否确用 `van-switch`（在位=1/缺失=0）？消耗品是否用数字输入实数？—— 影响态2 表单组件选型。（已依据后端语义默认采用此方案，请确认。）
2. **「物料」Tab 形态**：是做成「物料中心页 4 tile 跳转」（推荐，Tab 不过多），还是直接拆成 4 个底部 Tab（备件/消耗品/盘点/出入库）？—— 由架构师定，PRD 默认采用中心页方案。
3. **独立领用页是否复用 `ScanResultPopup` 组件实例**：建议直接挂 `<ScanResultPopup>` 复用其 borrow/take 逻辑；或仅抽取其方法。请确认复用粒度（PRD 默认整组件复用）。
4. **盘点「应盘总数」是否可知**：手机端创建盘库单后，后端是否返回应盘 item 清单？若否，进度仅能显示「已录入 N 项」，无法显示「应盘 Y 项」——需确认 `InventoryCheck.items` 初始是否为空。
5. **角色权限**：是否需按 `role`（如 `material_manager`）限制「创建盘点」「查看出入库」？本迭代默认不限制（P2），请确认。
6. **底部 TabBar 重复实现**：当前各页各自写 `van-tabbar`（实际代码为 首页/工具/工单/我的 + 扫码浮动按钮，与简报描述的 5 项略有出入）。新增「物料」Tab 时是否顺带抽公共组件（P2-3）？—— 本迭代至少保证新增入口，重构可选。

## 7. 复用清单（零新增依赖 / 工具模块零回归）

### 7.1 可直接复用的 API（来自 `@/api/material`，无需改动）
| API | 用途 |
| --- | --- |
| `getInventoryChecks` / `createInventoryCheck({warehouse_id, operator?})` / `scanInventoryCheck(id, code, actual_qty?)` / `completeInventoryCheck(id)` | 盘点全流程 |
| `getStockMovements(params?)` | 出入库流水列表与筛选 |
| `getSpareParts` / `getSpareByCode` / `borrowSpareByCode(code, {scene, expected_return, purpose})` | 备件列表 / 解析 / 领用（生成工单） |
| `getConsumables` / `getConsumableByCode` / `takeConsumableByCode(code, qty)` / `getLowStockConsumables` | 消耗品列表 / 解析 / 直领 / 低库存 |
| `getMaterialCategories` | 分类展示（可选） |

### 7.2 可复用的基础 API（来自 `@/api`）
| API | 用途 |
| --- | --- |
| `getWarehouses()` | 盘点「选仓库」下拉数据源（**无需新增后端**） |

### 7.3 可复用的组件
| 组件 | 复用点 |
| --- | --- |
| `ScanResultPopup.vue` | **独立领用页详情直接复用**，含完整 `handleBorrowSpare` / `handleTakeConsumable` 逻辑，避免重写领用。 |
| `ScanTool.vue` | 盘点态2 的扫码入口，沿用前缀分发（`BJ-`备件 / `XH-`消耗品 / `G-`工具加篮 / `BX-`工具箱批量）；**工具相关逻辑零改动**。 |

### 7.4 可复用的类型（`@/types`）
`SparePart`、`Consumable`、`MaterialCategory`、`StockMovement`、`InventoryCheck`、`InventoryCheckItem`、`Warehouse` —— 字段齐全，新页面直接 `import` 使用，无需新增类型。

### 7.5 可复用的既有页面（作为入口目标）
- `SparePartList.vue`（`/spare-parts`）与 `ConsumableList.vue`（`/consumables`）：物料中心 tile 直接跳转；其既有「列表→详情→领用」能力可作为独立领用页的样式与交互参考（建议 P2-4 收敛其内联逻辑到 `ScanResultPopup`）。

### 7.6 回归保障
- **零后端改动**：26 个物料路由已全部就绪，前端仅调用。
- **工具模块零回归**：`ScanTool` 的 `G-`/`BX-`（工具加篮/工具箱）逻辑不被触碰；新增页面均为新增路由与组件，不影响既有 工具/工单/我的 流程。
- **零新增依赖**：不引入新 npm 包，全部基于既有 Vant 4 + Pinia + Vue Router。

---
*— 文档结束 —*
