# 增量 PRD：盘库货位化重写 + 入库单模块

> 背景：此前盘库逻辑按"逐物料编码盘点"设计（预置全部物料、按 BJ-/XH-/G- 编码匹配、完成落账）。
> 用户真实业务模型是**「货位一码、一种物料（备件或消耗品）」**：选仓库开始盘点 →
> 扫货位二维码 → 现场清点 → 实际与系统不同则填新库存 → 多则入库、少则出库（署名盘点人）。
> 旧模型与现场用法根本冲突，且入库流程不完善。本轮**重写盘库 + 新建入库单模块**。
> 用户已拍板：**盘库不含工具（货位二维码只对应备件/消耗品）**、**入库单模块本轮一并做**。

---

## 1. 产品目标
让库管员以「货位二维码」为主线盘点（扫码定位物料→看系统库存→填实盘→差异自动生成入库/出库流水，
署名盘点人）；并支持网页端建入库单、现场按工单扫码入库。

**验收标准（可测量）**
1. 盘库单创建后含该仓库全部备件/消耗品**参考清单**（系统库存已知，实盘默认为"未盘"）。
2. 扫货位二维码（location_code，如 A-01）能解析出该货位上的物料并回显系统库存；兼容直接扫物料编码。
3. 完成盘库仅对「已录入且有差异」的项生成流水：多了→`in`、少了→`out`，`operator=盘点人`、
   `remark="盘点出入库[单号]"`；**未录入的货位库存保持不变**（彻底消除"没扫=清零"）。
4. 入库单：网页端物料管理员可建单（类型/数量/目标货位）；现场扫码收货写 `in` 流水并同步库存；
   单物料快捷扫码填量可直接入库。
5. 工具（G-）不出现在盘库单中（维持现状，后续单独做工具盘点）。

---

## 2. 用户故事
- US1 库管员（盘点）：选仓库开单 → 走到货架扫货位码 → 系统显示该物料现有库存 → 清点后填实际数 → 完成盘库，差异自动出入库。
- US2 库管员（盘点·无扫码）：在电脑端盘库清单里直接改实盘数量（系统库存作参考），完成盘库。
- US3 物料管理员（入库）：网页端选物料+数量+目标货位，生成入库单。
- US4 现场人员（收货）：手机扫货位码，按入库工单确认数量，扫码入库，库存实时增加。
- US5 现场人员（快捷入库）：扫货位→物料→填量→直接生成入库单并入库。

---

## 3. 需求池

### P0（必须）
- **R1 盘库单创建只含备件/消耗品参考清单**：`POST /inventory-checks` 预置该仓库全部 spare+consumable 为 items，
  `system_qty=当前stock`、`actual_qty=null`、`counted=false`、`diff=0`；**不再预置工具**。保持"同仓库仅1个pending"约束。
- **R2 扫码解析货位码/物料码（resolve-only）**：`POST /inventory-checks/:id/scan` 新增"仅解析"语义——
  收到 `{code}` 且无 `actual_qty` 时，按 `location_code`（货位）→ 该货位上的物料 优先解析，
  失败再按物料编码（BJ-/XH-）解析；命中返回 `{item_type,item_code,item_name,system_qty,location}`；
  未命中返回 400/404。**编码归一化 trim+大写**（location_code 含字母数字连字符，大小写不敏感匹配）。
- **R3 录入实盘（write）**：`POST /inventory-checks/:id/scan` 收到 `{code, actual_qty}` 时，解析同 R2，
  命中后写 `actual_qty`、`counted=true`、`diff=actual-system`；actual 钳制非负整数。
- **R4 完成盘库落账（in/out）**：`POST /inventory-checks/:id/complete` 遍历 items，仅对 `counted && diff!==0`：
  `diff>0`→写 `in` 流水(qty=diff)、`diff<0`→写 `out` 流水(qty=|diff|)，`operator=check.operator_name`、`remark="盘点出入库[单号]"`，
  同步主表 `stock_qty=actual_qty`；**未录入项不写、不动库存**；移除旧工具处理分支。
- **R5 入库单建单**：新增 `inbound_orders` 表 + `POST /inbound-orders`（requireMaterialManager）：
  入参 `{item_type, item_code|item_id, qty, warehouse_id, shelf_id?, location_code|location_id, remark?}`；
  解析物料、校验货位归属仓库；建单 `status='pending'`。
- **R6 入库单列表**：`GET /inbound-orders`（authenticate）按 status/item_type 过滤，供现场选单。
- **R7 扫码收货**：`POST /inbound-orders/:id/receive`（authenticate）：可选 `{location_code, actual_qty?}`；
  若传 location_code 校验与单据货位一致（防误收）；写 `in` 流水(qty=单据qty或actual_qty)、同步库存+、标记 received。
- **R8 PC 盘库货位扫码+行内编辑**：`InventoryCheck.vue` 顶部"扫货位码"→resolve→定位高亮+聚焦行；
  实盘列仍行内编辑；完成调用 complete（后端只动有差异项）。移除工具行（后端不再下发）。
- **R9 小程序盘库货位扫码**：`InventoryScan.vue` 扫货位码→resolve→定位+高亮+聚焦输入框（显示系统库存）；
  填实盘 blur 提交；**移除 finish() 的"未录入自动补齐为系统量"**（新模型未录入不动）；移除工具/BX 分支。
- **R10 PC 入库单管理页**：新建页（或并入物料管理）建单表单（类型/物料搜索/数量/仓库→货架→货位级联/备注）+ 列表（待入库/已入库）+ 收货按钮。
- **R11 小程序扫码入库页**：扫货位→物料→填量→建单并收货（快捷）；或列待入库单→扫货位确认→收货。

### P1（应该）
- **R12 入库单部分收货/备注**：支持 actual_qty 与单据 qty 不同（实收≠计划），备注差异原因。
- **R13 盘库进度**：已录入数/应盘数（参考清单总数）进度展示。

### P2（可选）
- 工具独立盘点流程（G- 逐件）。
- 入库单打印/审批流。

---

## 4. 接口契约（后端）

### 盘库
- `POST /inventory-checks` `{warehouse_id}` → 预置备件/消耗品参考清单（无工具）。
- `GET /inventory-checks/:id` → 含 items（counted 字段）。
- `POST /inventory-checks/:id/scan`
  - resolve-only：`{code}` → 200 `{item_type,item_code,item_name,system_qty,location:{...}}`（命中）/ 400（无法识别）。
  - write：`{code, actual_qty}` → 200 `{message, item}`（counted=true, diff 更新）。
  - 校验：check 须 pending；location_code 优先解析→物料，否则物料编码；均不中→400；跨仓库→400。
- `POST /inventory-checks/:id/complete` → 仅 counted&&diff≠0 写 in/out 流水 + 同步库存；返回 adjustments。

### 入库单
- `POST /inbound-orders` `{item_type,item_code|item_id,qty,warehouse_id,shelf_id?,location_code|location_id,remark?}` → 建单 pending。
- `GET /inbound-orders?status=&item_type=` → 列表。
- `POST /inbound-orders/:id/receive` `{location_code?,actual_qty?}` → 校验货位→写 in 流水+同步库存+received。

### 数据新增
- `db.inbound_orders`：`{order_id,order_no,item_type,item_id,item_code,item_name,qty,warehouse_id,shelf_id,location_id,location_code,status,creator_id,creator_name,created_at,receiver_id,receiver_name,received_at,remark}`。
- `inventory_checks.items[].counted`：`boolean`（新增，默认 false）。

---

## 5. 与现有实现的关键差异（供工程师）
1. `materials.js:800-853` 创建盘库：**删除工具预置段（815-836）**，仅 spare+consumable，items 加 `counted:false`、`actual_qty:null`。
2. `materials.js:864-938` scan：改为"resolve-only 优先 location_code 解析"+"write 写 counted/diff"双语义；移除 BX-/G- 特殊处理（工具不在盘库）。
3. `materials.js:956-1023` complete：移除工具分支（971-991）；`adjust` 改为按 diff 正负写 `in`/`out`（992-1018）；仅 `counted && diff!==0` 处理。
4. `db.js`：seed 增加 `inbound_orders: []`；`readDB` 兼容。
5. PC `InventoryCheck.vue`：顶部加"扫货位码"resolve→定位；移除工具行渲染（保持兼容但后端无数据）；complete 调用不变。
6. 小程序 `InventoryScan.vue`：doScan 改 resolve+定位（不自动提交）；移除 finish 自动补齐与工具/BX 分支；提交改传 actual_qty。
7. 新增 `backend/routes/inbound.js`（或在 materials.js 内新增路由段）+ 注册到 server.js；前端 PC 页 + 小程序页。

---

## 6. 待确认（已按推荐执行，记录备查）
- 盘库不含工具：已确认（R1/R4 移除工具）。
- 入库单本轮一并做：已确认。
- 盘点流水用 in/out（非 adjust）：按用户"多了入库少了出库"执行。
- 入库单创建权限：物料管理员；收货：任意已登录现场人员。
- 单物料快捷入库：建单+收货链式调用（前端组合两个接口）。

## 7. 遗留/风险
- PC 盘亏复核 UI（之前为工具建的 `inventory_missing` 标记与复核页）本轮不再被盘库触发，保留为遗留（工具后续单独盘点可复用）。
- 旧一维码/二维码标签（BarcodeList 左码右文）仍可用于物料/货位标签打印；货位二维码内容建议 = location_code。
