# 路线B · 原生小程序迁移清单（工器具管理系统 → uni-app 微信小程序）

> **数据来源**：本清单基于本地已落盘方案 `docs/miniapp-tencent-deploy-plan.md`（架构师产出，2026-08-05）提取整理，并叠加本会话 MigraQ 远端结论：① 主体域名确认为 **.cn**（工信部批复后缀，可正常 ICP 备案）；② 路线B（原生重写）整体工期 **50–85 日历天**（关键路径 = 备案 7–20 工 + 微信审核 1–7 工）。
> **范围**：仅含技术迁移清单，不含人工费用（按用户要求）；工作量人日仅作工程量参考。

---

## 0. 迁移范围与关键前提

| 项 | 内容 |
|---|---|
| 迁移对象 | `mobile-frontend/`：Vue3 + TS + Vant4 + Pinia + vue-router(hash) + html5-qrcode |
| 规模 | 24 页面 + 3 组件 + 6 composables + 3 store |
| 后端 | **26+ 接口零改动复用**；仅新增微信登录接口 `POST /api/auth/wx-login` |
| 框架选型 | **uni-app（Vue3 + Vite + TS）**，新增 `miniapp/` 目录，与 H5 平级互不影响 |
| 🔴 硬前置 | 小程序 request / uploadFile / downloadFile 合法域名必须 **https + ICP 备案**；主体域名 **.cn** 可正常备案（7–20 工作日），备案通过后配置合法域名即可 |
| 状态管理 | Pinia 兼容 uni-app；仅 `localStorage → uni.getStorageSync/setStorageSync`（封装 `utils/storage.ts` 抹平差异） |

---

## 1. 组件替换映射表（Vant4 → uni-app，24 项）

| Vant4 组件（现有） | uni-app 替换 | 类型 | 备注 |
|---|---|---|---|
| `van-button` | 原生 `button` + 全局样式 | 替换 | 复杂按钮可自封装 |
| `van-cell` / `van-cell-group` | `uni-list` / `uni-list-item` | 替换 | uni-ui 自带 |
| `van-field` / `van-form` | `uni-forms` / `uni-easyinput` | 替换 | 表单校验 API 需适配 |
| `van-stepper`（盘点步进器） | `uni-number-box` | 替换 | 货架导航盘点核心交互，逻辑保留 |
| `van-tag` | 自封装 `AppTag` | 自封装 | 三态库存标签 |
| `van-dialog`（表单弹窗） | `uni-popup` + 表单 | 替换 | confirm 回调改 Promise/事件 |
| `van-popup` | `uni-popup` | 替换 | |
| `van-tabbar` / `van-tabbar-item` | **pages.json 原生 tabBar** | 替换 | 首页/工具/物料/工单/我的 |
| `van-nav-bar` | `uni-nav-bar`（或自定义导航） | 替换 | |
| `van-search` | `uni-search-bar` | 替换 | |
| `van-list` / `van-pull-refresh` | `onReachBottom` / `onPullDownRefresh` | 重写 | 小程序原生滚动分页 |
| `van-action-sheet` | `uni.showActionSheet` / `uni-popup` | 替换 | 命令式 |
| `van-dropdown-menu` / `-item` | `uview-plus u-dropdown` 或自封装 | 替换 | 工单/用户管理筛选 |
| `van-checkbox` | `uni-data-checkbox` / 原生 `checkbox` | 替换 | 工单现场清点 |
| `van-switch` | 原生 `switch` | 替换 | |
| `van-icon` | `uni-icons` | 替换 | 图标名逐个核对 |
| `van-image` | `uni-image` / 原生 `image` | 替换 | 图片域名入 downloadFile 白名单 |
| `van-loading` | 原生 loading / `uni-load-more` | 替换 | |
| `van-config-provider` | `page` 级 CSS 变量 | 重写 | 主题 JS → CSS |
| `showToast/showSuccessToast/...` | 封装 `utils/feedback.ts` → `uni.showToast/showLoading` | 封装 | 命令式 API 差异最大的点 |
| `showConfirmDialog` | 封装 → `uni.showModal` | 封装 | Promise 化适配 |
| `showNotify`（useAutoLogout） | `uni.showToast` 替代 | 替换 | |
| 底部安全区/刘海屏适配 | `uni-app` 内置 safe-area | 适配 | |
| 懒加载/骨架屏 | 原生 `onPageScroll` + 骨架组件 | 适配 | |

---

## 2. 页面迁移清单（现有 H5 views → 小程序页）

| 现有 H5 页面 | uni-app 目标页 | 复用度 | 主要工作 |
|---|---|---|---|
| 登录 `Login.vue` | `pages/login/index` | 30% | **重写**：加微信授权登录（wx.login → wx-login） |
| 仪表盘 `Dashboard.vue` | `pages/dashboard/index` | 85% | 模板换 uni 组件 |
| 工器具 `ToolManagement.vue`（1075 行） | `pages/tools/index` | 75% | 模板换 uni；筛选/弹窗改 uni-popup；**工作量最大** |
| 扫码 `ScanTool.vue`（604 行） | `pages/scan/index` | 40% | **重写**：html5-qrcode → `uni.scanCode` |
| 领用工单 `OrderManagement.vue` | `pages/orders/index` | 80% | 现场清点 checkbox 替换 |
| 领用篮 `ShoppingCart.vue` | `pages/cart/index` | 85% | |
| 我的 `Profile.vue` | `pages/profile/index` | 85% | |
| 备件 `SparePartList.vue` | `pages/materials/spare` | 80% | |
| 消耗品 `ConsumableList.vue` | `pages/materials/consumable` | 80% | 数量输入改 uni-number-box |
| 物料中心 `MaterialCenter.vue` | `pages/materials/index` | 85% | |
| 物料领用 `MaterialDispense.vue` | `pages/materials/dispense` | 85% | |
| 盘点列表 `Inventory.vue` | `pages/inventory/index` | 85% | |
| 创建盘库单 `InventoryCreate.vue` | `pages/inventory/create` | 85% | |
| 盘点扫码 `InventoryScan.vue` | `pages/inventory/scan` | 55% | **扫码重写**；录入逻辑保留 |
| 盘点结果 `InventoryResult.vue` | `pages/inventory/result` | 85% | |
| 货架导航盘点 `InventoryShelf.vue` | `pages/inventory/shelf` | 70% | 步进器→uni-number-box；货架→货位两级导航逻辑保留 |
| 出入库流水 `StockMovement.vue` | `pages/stock/movements` | 85% | |
| 库存单元格/筛选 `StockCell/StockFilter.vue` | `pages/stock/...` | 85% | |
| 管理页 ×6（Category/Dept/Location/Shelf/User/Warehouse） | `pages/admin/*`（**建议分包**） | 80% | 弹窗表单改 uni-popup |
| 组件 `InventoryScannerPopup.vue` | `components/ScannerPopup` | 50% | 扫码逻辑重写 |
| 组件 `ScanResultPopup.vue` | `components/ScanResultPopup` | 80% | 模板替换 |
| 组件 `MaterialCard.vue` | `components/MaterialCard` | 85% | |

---

## 3. 可复用 vs 需重写清单（API 层核心优势：后端零改动）

**零改动复用（纯逻辑）**：全部 API 函数、`store/auth`、`store/cart`、`store/scanHistory`、`types/index.ts`、`constants/material.ts`、`utils/stock.ts`、`composables/useAutoLogout.ts`、`useMaterialList.ts`、`useInventoryEntered.ts`。

**仅替换请求底层**：`axios.create({ baseURL: '/api' })` → `utils/request.ts` 基于 `uni.request` 封装：
- baseURL：dev 走代理 / prod 用 `https://api.你的可备案域名`
- token：`localStorage.getItem('token')` → `uni.getStorageSync('token')`
- 401：清 token 跳登录；错误提示走 `utils/feedback.ts`

**需重写**：`composables/useScanner.ts` + `useBrightness.ts`（浏览器 getUserMedia → 小程序扫码）。

---

## 4. 扫码能力改造（核心差异点）

| 能力 | H5（html5-qrcode） | 小程序（uni.scanCode） | 影响 |
|---|---|---|---|
| 触发 | getUserMedia + 视频流解析 | 调系统相机 | 重写 |
| 条码类型 | CODE_128/EAN_13/CODE_39 | `scanType: ['barCode']` 默认全支持 | 简化 |
| 弱光增强 | 手电筒/曝光/ISO 约束 | 系统相机自动对焦，无 torch/曝光 API | **降级**：依赖系统相机 |
| 连续扫码 | 停止→清理 DOM→重启 | 每次回调，循环调用 | 更简单 |
| 权限 | 浏览器授权 + HTTPS | 微信首次授权，无需 HTTPS 也可用 | 更简单 |
| 手动输入降级 | 已有 | 保留（扫码失败弹输入框） | 保留 |

**入口改造**：`ScanTool.vue`、`InventoryScan.vue`、`InventoryScannerPopup.vue` 三处统一改 `uni.scanCode` + 手动输入兜底。
> ⚠️ 若走 web-view 套壳（路线A）：web-view 内**不能调 wx.scanCode**【MigraQ远端确认】，需原生页桥接——这也是推荐路线B 的核心原因。

---

## 5. 微信登录对接（新增后端接口）

**`POST /api/auth/wx-login`** `{ code, nickname?, avatar? }`
1. 校验 code → 后端调微信 `jscode2session(appid, secret, code)` 换 openid
2. 按 openid 查 users：
   - 已绑定 → 签发 JWT（与现有 /auth/login 一致，7d）→ `{ access_token, user, need_bind_phone: false }`
   - 未绑定 → 自动注册 staff（`username=wx_<openid前8位>`）→ 签发 JWT → `{ access_token, user, need_bind_phone: true }`
3. `session_key` **绝不返回前端**

**可选配套**：`POST /api/auth/wx-bind-phone` `{ phone }`（携带 JWT）→ 校验手机号 → 绑定 wx_openid → 关联现有账户。

**数据层**：users 新增 `wx_openid`/`wx_unionid`/`wx_nickname`/`wx_avatar`；`db.js` 的 `migrateDB()` 幂等补字段（兼容旧 db.json）；数据存**服务器本机**（不采购云数据库 MySQL），若启用本机 MySQL 则对 `wx_openid` 建唯一索引。

**安全**：code 一次性（微信侧保证）；复用 `loginLimiter` 登录限流；`WX_APPID`/`WX_SECRET` 仅存服务器环境变量。

---

## 6. 任务拆分 U01–U05 与工期

| 任务 | 内容 | 依赖 | 工作量参考 |
|---|---|---|---|
| **U01** 工程初始化 | 模板、vite/tsconfig、manifest、pages.json（路由+tabBar）、main.ts、utils/request·storage·feedback、types、全局样式 | 无 | 1.5 人日 |
| **U02** 数据层与公共能力 | api/index、api/material、store×3、constants、utils/stock、composables×3、**useScanner 重写** | U01 | 2 人日 |
| **U03** 核心业务页面 | 登录/仪表盘/工具/扫码/工单/领用篮/物料×5/盘点×5/库存/组件×3 | U02 | 4–5 人日 |
| **U04** 辅助页与管理分包 | profile、admin×6、分包 subpackages.json、样式收尾 | U03 | 1.5 人日 |
| **U05** 微信登录 + 集成调试 | 后端 wx-login/wx-bind-phone、db.js 字段、授权流、体验版联调、真机扫码/相机验证、包体积优化 | U03 | 2 人日 |

**工期口径**：
- 工程量：11–12 人日（复用度高，并行 2 人约 6–8 自然日）；交付工程师保守区间 15–30 人日【MigraQ远端不覆盖前端工程量，经验估算】
- **日历天：路线B 整体 50–85 天**（关键路径 = ICP+小程序备案 7–20 工 + 微信审核 1–7 工，开发与备案可并行）

---

## 7. 提审发布要点

1. 类目：**工具 > 办公/管理** 或 **商业服务 > 企业管理**
2. 「用户隐私保护指引」必须声明：手机号、摄像头、相册（否则审核被拒）
3. 分包：uni-app 主包 2MB 限制，`pages/admin/*` 与库存流水放分包
4. 图片上传：`uni.uploadFile` 单独封装（与 axios FormData 行为不同）；downloadFile 白名单配全
5. 提交前清理体验版测试数据

---

## 8. 待明确决策项（影响实现，需业务方拍板）

| # | 决策项 | 选项 |
|---|---|---|
| 1 | 微信登录策略 | 任何人自动注册 staff / 仅管理员预绑定后登录 |
| 2 | 小程序主体 | **已定：个人主体**（免费，无需企业认证；类目受限、无微信支付） |
| 3 | 首次登录是否强制绑手机号 | 强制绑定现有账户 / 独立微信账号即可 |
| 4 | 数据存储 | **已定：不采购云数据库**——数据存服务器本机 db.json + 每日备份；如需关系库，本机自装 MySQL（不购买云数据库实例） |
| 5 | CDN 是否启用 | 单台轻量收益有限，建议暂缓 |
| 6 | 域名最终选择 | .cn（最省）/ .com（品牌）——两者均可备案 |

---

## 9. 与路线A（web-view 套壳）的关键差异

| 项 | 路线A 套壳 | 路线B 原生（本清单） |
|---|---|---|
| 工期 | 28–50 日历天 | 50–85 日历天 |
| 扫码 | ⚠️ 需原生页桥接，绕 | ✅ uni.scanCode 直调 |
| 更新 | 改 H5 即时生效免审核 | 每次改版需提审 |
| 体验/审核 | 一般、更严 | 原生、常规审核 |
| 长期 | 应急过渡 | 正式运营推荐 |
