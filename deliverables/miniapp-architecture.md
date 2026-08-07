# 工器具管理系统 — 微信小程序架构设计方案

> 版本：v1.0 ｜ 日期：2026-08-07 ｜ 状态：已落地可编译
> 技术选型：uni-app Vue3 + TypeScript + Pinia + uni-ui（编译到微信小程序）
> 对照蓝本：本系统移动端 H5（mobile-frontend，Vue3 + Vant4）

---

## 1. 总体架构

```
┌───────────────────────────── 微信生态 ─────────────────────────────┐
│  微信 App                                                        │
│  ├─ 入口：扫码(工具/货架二维码) / 搜索 / 分享卡片 / 公众号菜单      │
│  ├─ 小程序运行层（渲染层 + 逻辑层双线程）                          │
│  │   └─ miniapp/  (uni-app 编译产物 → dist/dev/mp-weixin)        │
│  └─ 能力调用：wx.login / wx.scanCode / wx.request / wx.getLocation│
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTPS（生产）/ HTTP（开发调试）
                               ▼
┌────────────────────── 小程序专用 API 网关 ────────────────────────┐
│  端口 3300（新增，独立于 3000/3100/3200）                        │
│  ├─ 开发/真机预览：backend/server.js 直接起 PORT=3300 HOST=0.0.0.0│
│  └─ 生产：HTTPS 域名 → nginx 反代 127.0.0.1:3300                │
└──────────────────────────────┬────────────────────────────────────┘
                               ▼
┌────────────────────── 核心业务服务 ───────────────────────────────┐
│  backend/server.js (Express)  ── 同一份代码、同一份 db.json      │
│  routes: auth / tools / orders / materials / users / admin      │
│  与 PC 端(3000)、H5 移动端(3200)共享同一数据源                   │
└──────────────────────────────────────────────────────────────────┘
```

**核心设计原则：一套后端，多端复用。** 小程序不新建后端，而是通过独立端口 3300 复用现有 Express 服务，数据完全打通——PC 端入库的物料，小程序扫码立即可见。

---

## 2. 技术选型（对比决策）

| 维度 | 选型 | 理由 |
|------|------|------|
| 框架 | **uni-app Vue3 + Vite + TS** | 与 mobile-frontend 同为 Vue3 语法，页面/API/Store 迁移成本≈0；一套代码可扩展 H5/App |
| 状态管理 | Pinia | 与 H5 端一致，`store/auth.ts`、`store/cart.ts` 直接复用 |
| UI 组件 | uni-ui（内置） | 微信端原生组件适配，无需引 Vant（Vant 在小程序端性能一般） |
| 请求层 | 自研 `utils/request.ts` | uni.request Promise 化封装，自动携带 JWT、401 统一登出 |
| 扫码 | `wx.scanCode`（已声明 `requiredPrivateInfos`） | 工具条码 `BX-{id}`、物料编码 `BJ-/XH-/G-` 前缀识别 |
| 定位 | `wx.getLocation` | 仓库/货架导航（manifest 已声明 scope.userLocation） |
| 构建 | `@dcloudio/vite-plugin-uni` → mp-weixin | 官方工具链，`npm run dev:mp-weixin` 热编译 |

---

## 3. 工程结构（miniapp/）

```
miniapp/
├── src/
│   ├── pages/                  # 主包（16 页，约 ≤2MB）
│   │   ├── login/Login.vue        # 手机号免密登录
│   │   ├── dashboard/Dashboard.vue# 首页（待办+快捷入口）
│   │   ├── tools/ToolManagement.vue
│   │   ├── material/              # 物料中心/备件/消耗品/领用
│   │   ├── orders/OrderManagement.vue
│   │   ├── scan/ScanTool.vue      # 扫码入口
│   │   ├── cart/ShoppingCart.vue  # 领用篮
│   │   ├── inventory/             # 盘点四步流
│   │   └── profile/Profile.vue
│   ├── pagesAdmin/             # 分包1：基础数据管理（6 页）
│   ├── pagesStock/             # 分包2：库存流水（3 页）
│   ├── api/                    # 接口定义（index/material）
│   ├── store/                  # Pinia（auth/cart/scanHistory）
│   ├── composables/            # useScanner/useMaterialList/useInventoryEntered/useAutoLogout
│   ├── utils/                  # request/storage/feedback/stock
│   ├── constants/  types/  static/
│   ├── pages.json              # 路由+tabBar+分包+preloadRule
│   └── manifest.json           # appid/隐私声明/权限声明
├── .env.development            # VITE_API_BASE_URL=http://localhost:3300/api  ← 已改
├── .env.production             # VITE_API_BASE_URL=https://<域名>/api      ← 上线前替换
└── project.config.json         # 开发者工具配置（appid 待替换）
```

**分包与预加载策略**（已配置）：
- 主包 16 页（登录/首页/工具/物料/工单/扫码/领用篮/盘点/我的）
- 分包 A `pagesAdmin`（管理页，低频）→ 首页启动即预加载（`preloadRule`）
- 分包 B `pagesStock`（库存流水，低频）
- `lazyCodeLoading: requiredComponents` 按需注入组件，降低首包体积

---

## 4. 与手机客户端（mobile-frontend）对照关系

| 能力 | mobile-frontend（H5/Vant4） | miniapp（uni-app/uni-ui） | 复用方式 |
|------|---------------------------|--------------------------|---------|
| API 定义 | `src/api/index.ts` + `material.ts` | `src/api/index.ts` + `material.ts` | **同构**，仅 baseURL 不同 |
| 登录 | 手机号免密 `POST /auth/login {phone}` | 相同 + 可扩展 `wx.login` 静默登录 | 后端同路由 |
| 状态管理 | Pinia（auth/cart） | Pinia（auth/cart/scanHistory） | 同构 |
| 页面 | views/（Vant 组件） | pages/（uni-ui 组件） | 业务逻辑逐页迁移，已完成 |
| 扫码 | `html5-qrcode`（浏览器摄像头） | `wx.scanCode`（原生扫码） | 小程序体验更佳 |
| 盘点 | 页面流 | 页面流 + 扫码录入 | 同一套后端接口 |

> 结论：小程序端是 H5 移动端能力的"原生化封装"——**接口契约、数据模型、业务流程完全一致**，两端可并行维护，后端零改动。

---

## 5. 端口规划（核心改动：独立 3300）

### 5.1 端口分配表

| 服务 | 端口 | 绑定 | 说明 |
|------|------|------|------|
| 后端 API（PC/H5 共用） | 3000 | 127.0.0.1 | 保持原样，**未改动** |
| PC 前端 | 3100 | 0.0.0.0 | 保持原样 |
| H5 移动端 | 3200 | 0.0.0.0 | 保持原样 |
| **小程序 API 网关** | **3300** | **0.0.0.0** | **本次新增，独立端口** |

### 5.2 为什么需要独立端口

1. **避免与现有服务冲突**：3000 已有 PC/H5 在用，小程序复用一个端口会互相干扰（重启、日志、鉴权策略）。
2. **真机预览可达性**：小程序真机无法访问 `127.0.0.1`，3300 实例以 `HOST=0.0.0.0` 监听，局域网/云服务器均可访问。
3. **生产可独立升级**：将来小程序需要限流、风控、签名等网关能力时，只需在 3300 前面加一层，不影响 3000。

### 5.3 已落地的改动

| 文件 | 改动 |
|------|------|
| `miniapp/.env.development` | `VITE_API_BASE_URL=http://localhost:3300/api` |
| `miniapp/.env.production` | 保持 HTTPS 域名占位，注释说明白名单/反代要求 |
| `backend/server.js` | 新增 `HOST` 环境变量（默认 127.0.0.1 不变，3300 用 0.0.0.0） |
| `ecosystem.config.js` | 新增 PM2 进程 `tools-backend-miniapp`（PORT=3300, HOST=0.0.0.0） |

### 5.4 启动方式

```bash
# 开发调试（本机，微信开发者工具中勾选"不校验合法域名"）
npm --prefix miniapp run dev:mp-weixin          # 编译小程序
PORT=3300 node backend/server.js                # 或直接：
pm2 start ecosystem.config.js --only tools-backend-miniapp

# 生产（域名 + HTTPS）
# nginx 443 → 127.0.0.1:3300（nginx 配置见 deploy/production/nginx-domain.conf）
pm2 start ecosystem.config.js --env production
```

> 注意：生产环境小程序要求 **HTTPS + request 合法域名白名单**，`localhost` 仅限开发者工具调试。

---

## 6. 关键数据流

### 6.1 登录（手机号免密 + 可选微信静默）

```
用户打开小程序
  → pages/login/Login.vue 输入手机号
  → POST /auth/login {phone}
  → 后端校验 + JWT
  → store/auth.ts 存 token + user
  → reLaunch 到首页
```

扩展点：`wx.login()` 获取 code → `POST /auth/wx-login` 静默换 token，实现"一键登录"（接口已在 `api/index.ts` 预留）。

### 6.2 扫码领用（核心高频场景）

```
扫码 → wx.scanCode → 解析条码（BX-{id}/BJ-{code}/XH-{code}/G-{code}）
  → 查工具/物料详情 → 加入领用篮(cart store) → 提交工单
  → POST /orders → 状态流转 → 订阅消息提醒审批结果
```

### 6.3 盘点（三阶段，与后端 inventory-checks 完全对齐）

```
创建盘点(选仓库) → POST /inventory-checks
扫码录入 → POST /inventory-checks/:id/scan（编码前缀识别类型）
完成盘点 → POST /inventory-checks/:id/complete（diff≠0 自动落账）
```

---

## 7. 上线前清单（快速上线路径）

### 7.1 必须项（阻塞）

| # | 事项 | 位置 |
|---|------|------|
| 1 | 注册小程序 AppID，替换 `project.config.json` 与 `manifest.json` 中 `touristappid` | 微信公众平台 mp.weixin.qq.com |
| 2 | 准备 HTTPS 域名，替换 `.env.production`，微信后台配置 **request 合法域名** | 公众平台 → 开发管理 → 服务器域名 |
| 3 | nginx 反代 443 → 127.0.0.1:3300（复用 `deploy/production/nginx-domain.conf`） | 服务器 |
| 4 | 填写《小程序用户隐私保护指引》（已声明 scanCode/定位） | 公众平台 → 设置 → 服务内容声明 |
| 5 | `tools-backend-miniapp` PM2 进程上线 | 服务器 pm2 |

### 7.2 增长项（快速获客）

| 玩法 | 落地 |
|------|------|
| 扫码直达 | 工具/货架二维码 → `pages/scan/ScanTool`，现场即用即领 |
| 分享裂变 | `onShareAppMessage` 分享工单/物料卡片（各页面已可配置） |
| 订阅消息 | 领用单审批/归还提醒（`wx.requestSubscribeMessage`，模板需在公众平台申请） |
| 体验版分发 | 内部先跑通 → 体验版 → 提交审核（类目：工具/办公类） |

### 7.3 提审注意

- 服务类目与营业执照匹配；涉及"工具管理/企业内部"建议选 **办公-企业内部管理**
- 首页需有明确功能引导，避免"体验不佳"驳回
- 定位权限必须在使用时触发（manifest 已声明 desc），不可默认获取

---

## 8. 已知注意事项

1. **双实例共享 db.json**：3300 与 3000 共用 `backend/db.json`，低并发场景没问题；若并发写频繁，后续可拆为单一实例 + nginx 多 location（推荐演进方向）。
2. **H5 端 Vant 组件不能直接用**：小程序端用 uni-ui/原生组件，样式需各自维护（页面逻辑已迁移完成）。
3. **图片上传**：后端已有 `/uploads` 静态服务，小程序 `uni.chooseImage` + `uni.uploadFile` 走 3300 同域，注意生产域名白名单需同时配置 **uploadFile** 域名。
4. **urlCheck=false 仅限开发**：生产必须 HTTPS，否则真机白屏。

---

## 附：快速验证命令

```bash
# 1. 起 3300 后端
PORT=3300 node backend/server.js
# 2. 健康检查
curl http://localhost:3300/api/health
# 3. 编译小程序（微信开发者工具打开 dist/dev/mp-weixin）
npm --prefix miniapp run dev:mp-weixin
```

---

*本文档对应改动提交后，与仓库 docs/ 目录既有设计文档相互印证。*
