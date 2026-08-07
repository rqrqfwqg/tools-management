# 路线B · 原生小程序开发实施计划（可执行版）

> 基于 `路线B_原生小程序迁移清单.md` 细化，把 U01–U05 拆成 **Sprint + 每日任务 + 文件级改动 + 验收标准**。
> 技术前提不变：uni-app（Vue3+Vite+TS）新增 `miniapp/` 目录；后端 26+ 接口零改动复用；数据存服务器本机 db.json；主体域名 `.cn`（已可备案）；小程序个人主体（免费）。
> 工期口径：纯开发 11–12 人日（2 人并行约 6–8 自然日）；**整体日历 50–85 天**（关键路径 = 备案 7–20 工 + 微信审核 1–7 工，开发与备案可并行）。

---

## 0. 并行关系总览

```
[硬前置·可并行启动]  ICP备案(.cn, 7-20工)  ─┐
                                            ├─→ 审核发布(1-7工) ─→ 上线
[Sprint 1-5 开发]     工程→数据层→业务页→辅助页→登录联调 ─┘
```

> 备案一启动就立刻开工 Sprint 1，**不要等备案通过再写代码**——开发完正好备案也下来了。

---

## 1. Sprint 拆分与每日任务

### S1 · 工程初始化（U01，1.5 人日）
| 任务 | 涉及文件 / 动作 | 验收标准 |
|---|---|---|
| 1.1 建 `miniapp/` 工程 | `npm init` + uni-app Vue3+Vite+TS 模板；配 `manifest.json`（appid、小程序名称）、`vite.config.ts`、`tsconfig.json` | `npm run dev:mp-weixin` 能编译出 `dist/dev/mp-weixin` |
| 1.2 路由与 tabBar | `pages.json`：注册全部页面 + 5 个 tabBar（首页/工具/物料/工单/我的）+ 分包 `subPackages`（admin×6、stock 流水） | HBuilderX/CLI 编译无路由报错；tabBar 图标就位 |
| 1.3 请求/存储/反馈底座 | 新增 `utils/request.ts`（`uni.request` 封装，baseURL 按 env 切换）、`utils/storage.ts`（抹平 localStorage→uni.getStorageSync）、`utils/feedback.ts`（showToast/showModal Promise 化） | 单测：`request` 在 dev 走代理、prod 走 `https://api.你的.cn`；401 自动清 token 跳登录 |
| 1.4 类型与全局样式 | 拷贝 `types/index.ts`、`constants/material.ts`；写 `uni.scss` 主题变量（替代 Vant 主题 JS） | TS 编译通过；主题色生效 |

### S2 · 数据层与公共能力（U02，2 人日）
| 任务 | 涉及文件 / 动作 | 验收标准 |
|---|---|---|
| 2.1 API 层复用 | 拷贝 `api/index.ts`、`api/material.ts` 等；仅替换 axios 底层为 `utils/request.ts` | 所有现有接口函数签名不变，dev 下能与后端联调 |
| 2.2 状态管理 | 拷贝 `store/auth`、`store/cart`、`store/scanHistory`（Pinia 直接兼容） | 登录态、购物车、扫码历史在真机持久化正常 |
| 2.3 工具与 composables | 拷贝 `utils/stock.ts`、`composables/useAutoLogout.ts`、`useMaterialList.ts`、`useInventoryEntered.ts` | 逻辑无改写可直接用 |
| 2.4 🔴 扫码重写 | **重写** `composables/useScanner.ts`（`uni.scanCode` + 手动输入兜底）、删除 `useBrightness.ts`（小程序无 torch/曝光 API，依赖系统相机） | 调用 `uni.scanCode({scanType:['barCode','qrCode']})` 成功解析；扫码失败弹出手动输入框 |

### S3 · 核心业务页面（U03，4–5 人日）— 工作量最大
> 复用度低的优先做，避免后期返工。

| 优先级 | 页面 | 源文件 | 主要改动 | 验收 |
|---|---|---|---|---|
| P0 | 登录 `pages/login` | `Login.vue`(30%) | **重写**：加微信授权按钮 → `wx.login` 拿 code → 调 `wx-login` | 微信一键登录拿到 JWT 并跳转首页 |
| P0 | 扫码 `pages/scan` | `ScanTool.vue`(40%) | **重写**：`useScanner` 接入；盘点/领用入口 | 真机相机扫码解析设备码成功 |
| P1 | 工具 `pages/tools` | `ToolManagement.vue`(1075行,75%) | 模板换 uni 组件；筛选/弹窗改 `uni-popup` | 列表/筛选/详情可用 |
| P1 | 工单 `pages/orders` | `OrderManagement.vue`(80%) | 现场清点 `van-checkbox`→`uni-data-checkbox` | 领用现场清点提交成功 |
| P1 | 物料×5 | `SparePartList/ConsumableList/MaterialCenter/MaterialDispense` 等(80%) | 数量输入 `van-stepper`→`uni-number-box` | 备件/消耗品 CRUD 正常 |
| P1 | 盘点×5 | `Inventory/Create/Scan/Result/Shelf`(55–85%) | `InventoryScan`/`InventoryShelf` 扫码重写；步进器换 `uni-number-box` | 创建盘库单→扫码录入→完成落账一致 |
| P2 | 库存/领用篮/我的 | `StockMovement/ShoppingCart/Profile`(85%) | 模板替换 | 流水查看、购物车、个人页正常 |

### S4 · 辅助页与管理分包（U04，1.5 人日）
| 任务 | 涉及文件 | 验收 |
|---|---|---|
| 4.1 个人页与 6 个管理页 | `Profile.vue` + `Category/Dept/Location/Shelf/User/Warehouse Management`(80%) | 弹窗表单改 `uni-popup`；管理功能可用 |
| 4.2 分包收尾 | `subPackages` 配 `admin/*` 与库存流水；主包 < 2MB | 编译提示主包体积达标 |
| 4.3 全局样式与组件收尾 | `MaterialCard`、`ScanResultPopup` 等组件(80–85%) | UI 视觉对齐 H5 版 |

### S5 · 微信登录 + 集成调试（U05，2 人日）
| 任务 | 涉及文件 / 动作 | 验收标准 |
|---|---|---|
| 5.1 后端 wx-login | `backend/routes/auth.js` 新增 `POST /api/auth/wx-login`（jscode2session→openid→JWT 7d）；可选 `wx-bind-phone` | 用 code 调用返回 access_token；`session_key` 不返回前端 |
| 5.2 数据层字段 | `backend/routes/db.js` 的 `migrateDB()` 幂等补 `wx_openid/wx_unionid/wx_nickname/wx_avatar` | 旧 db.json 启动自动补全字段不报错 |
| 5.3 授权流与联调 | 小程序登录页接 5.1；体验版联调 | 真机微信授权→登录→首页数据加载 |
| 5.4 真机验证与优化 | 真机扫码/相机、包体积、隐私指引 | 真机扫码秒出；主包合规；隐私声明含摄像头/相册 |

---

## 2. 后端改动清单（具体到文件）

| 文件 | 改动 | 说明 |
|---|---|---|
| `backend/routes/auth.js` | 新增 `router.post('/auth/wx-login', loginLimiter, ...)` | 调微信 `jscode2session` 换 openid；按 openid 查/建用户；签发 JWT（复用现有 7d 逻辑）；接入 `loginLimiter` 限流 |
| `backend/routes/auth.js` | （可选）新增 `router.post('/auth/wx-bind-phone', authenticate, ...)` | 携带 JWT 绑手机号，关联现有账户 |
| `backend/routes/db.js` | `migrateDB()` 补 `wx_*` 字段 | 幂等：`if (!u.wx_openid) u.wx_openid = ''`，兼容旧数据 |
| 环境变量 | 新增 `WX_APPID` / `WX_SECRET` | **仅服务端**，绝不进前端包 |

> 其余 26+ 接口**零改动**——这是路线B 的最大省力点。

---

## 3. 验收总清单（提审前必过）

- [ ] `npm run build:mp-weixin` 编译通过，无 TS 错误
- [ ] 主包 < 2MB，`admin/*` 与库存流水在分包
- [ ] 真机微信授权登录成功，JWT 持久化
- [ ] 真机 `uni.scanCode` 扫码解析设备码/物料码成功（含手动输入兜底）
- [ ] 借出/归还/盘点核心流程在真机跑通（数据落服务器 db.json）
- [ ] 图片上传走 `uni.uploadFile`，downloadFile 域名白名单配全
- [ ] 隐私保护指引声明：手机号、摄像头、相册
- [ ] 类目选「工具 > 办公/管理」
- [ ] ICP 备案已通过，request/uploadFile/downloadFile 合法域名已配置（https + 已备案 .cn）
- [ ] 体验版清理测试数据后再提审

---

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| 主包超 2MB 提审失败 | 管理页/流水尽早分包；图片走 CDN/ COS 外链不进包 |
| 扫码弱光体验下降（无 torch） | 依赖系统相机自动对焦；保留手动输入兜底，盘点场景够用 |
| 隐私指引漏声明被驳回 | 提交前按 §3 清单逐项勾选 |
| 备案延迟卡住上线 | 备案与开发并行启动；审核驳回预留 +1–7 工缓冲 |
| Vant 组件逐个替换遗漏 | 按 `路线B_原生小程序迁移清单.md` 的 24 项映射表逐条核对 |

---

## 5. 待业务方拍板的 2 项（影响 S3/S5 实现）

1. **微信登录策略**：任何人自动注册 staff / 仅管理员预绑定后登录
2. **首次登录是否强制绑手机号**：强制绑定现有账户 / 独立微信账号即可

（主体=个人、数据=服务器本机、域名=.cn 均已定，无需再议。）
