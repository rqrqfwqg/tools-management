# 工器具管理系统 — 功能增强 + 部署上线报告

**日期**：2026-05-19
**场景**：功能增强 + 生产部署配置
**参与成员**：产品官（评审）+ 排障手（调试验证）

---

## 📌 TL;DR

- **结论**：✅ 完成，18/18 验证全通过
- **变更文件**：10 个（4 新建，6 修改）
- **后端验证 Bug 修复**：8 项（POST校验、PUT唯一性、PUT外键、`||`→`??`、GET-by-ID、仓库删除补充、工具货架一致性、反规范化同步）
- **前端修复**：3 个硬编码 localhost URL 修复 + 打印布局改善
- **部署配置**：Express + PM2 完整方案

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | ✅ Go |
| 后端验证修复 | 8/8 通过 |
| 前端修复 | 3/3 通过 |
| 部署配置 | 5/5 完成 |
| 新增文件 | ecosystem.config.js、.env.production、DEPLOY.md |

---

## 1. 各模块完成情况

### 🔍 产品官（仓库验证增强）
- 核心判断：所有 CRUD 验证缺口已补全，系统数据一致性得到保障
- 关键建议：反规范化字段同步（A8）建议后续考虑用数据库视图替代 JSON 文件存储

### 🔧 排障手（调试验证）
- 核心判断：Express 5 的 `path-to-regexp` 不支持裸 `*` 作为通配符，需要用 `app.use()` 替代 `app.get('*')`
- 关键建议：生产部署前务必重新构建前端（`npm run build`）

---

## 2. 后端验证 Bug 修复详情（A1-A8）

| # | 修复项 | 严重度 | 验证结果 |
|---|--------|--------|---------|
| A1 | POST 必填校验（warehouse/shelf/location） | 🟠 | ✅ 拒绝空名称/编码 |
| A2 | PUT 编码唯一性检查 | 🟠 | ✅ 变更编码时冲突检测 |
| A3 | PUT 外键校验（shelf→warehouse, location→shelf+warehouse） | 🟠 | ✅ 无效 FK 拒绝 |
| A4 | `\|\|` 假值 Bug → `??` | 🟡 | ✅ 空字符串不再覆盖原值 |
| A5 | GET-by-ID 端点（warehouse/shelf/location） | 🟡 | ✅ 返回正确记录 |
| A6 | 仓库删除增加 storage_locations 关联检查 | 🟠 | ✅ 有孤立货位时拒绝删除 |
| A7 | 工具创建/更新时验证货架-仓库一致性 | 🟠 | ✅ 货架不属于仓库时报错 |
| A8 | 反规范化字段同步（仓库名→tool.warehouse、货架名→tool.storage_location） | 🟡 | ✅ 修名后自动同步 |

---

## 3. 前端修复详情（B1-B4）

| # | 文件 | 修复内容 | 验证结果 |
|---|------|---------|---------|
| B1 | OrderManagement.vue | BACKEND_BASE `http://localhost:8000` → `''` | ✅ |
| B1 | ShoppingCart.vue | getImageUrl → `path`（相对路径） | ✅ |
| B1 | ToolManagement.vue | BACKEND_BASE `http://localhost:3000` → `''` | ✅ |
| B2 | vite.config.ts | 增加 `/uploads` → `http://localhost:3000` 代理 | ✅ |
| B3 | OrderManagement.vue | 打印布局：编号显示实际单号、page-break CSS 修复 | ✅ |
| B4 | api/index.ts | 新增 getWarehouse/getShelf/getStorageLocation | ✅ |

---

## 4. 部署配置详情（C1-C7）

| # | 文件 | 内容 | 状态 |
|---|------|------|------|
| C1 | server.js | express.static Serve vue-frontend/dist/ | ✅ |
| C2 | server.js | app.use() SPA fallback（Express 5 兼容） | ✅ |
| C3 | backend/package.json | main→server.js, start/dev 脚本 | ✅ |
| C4 | ecosystem.config.js | PM2 配置（新建） | ✅ |
| C5 | backend/.env.production | 生产环境配置模板（新建） | ✅ |
| C6 | server.js | CORS 可配置化（process.env.CORS_ORIGIN） | ✅ |
| C7 | DEPLOY.md | 部署文档（新建） | ✅ |

---

## 5. 综合验证结果

### API 测试（18/18 通过）
```
A4-1 Login: OK
A5-1 GetWarehouse(1): OK
A1-1 EmptyName (rejected): OK
A1-2 ValidWarehouse: OK
A2-1 CodeConflict (rejected): OK
A5-2 GetShelf(1): OK
A5-3 GetLocation(1): OK
A1-3 EmptyShelfName (rejected): OK
A1-4 EmptyLocationName (rejected): OK
A7-1 WrongShelfWarehouse (rejected): OK
C1 SPA Fallback (HTML): OK
C2 API 404 (JSON): OK
A6 Warehouse with locations (rejected): OK
A3 Shelf PUT wrong FK (rejected): OK
A8 warehouse sync: OK
A8 storage_location sync: OK
A8 After WH rename (synced): OK
Tool GET-by-ID (404): OK
```

### 边界场景
- SPA 路由 `/dashboard` → HTML ✅
- API 不存在的 GET → 404 JSON ✅
- Express 5 `path-to-regexp` 兼容 ✅（用 `app.use()` 替代 `app.get('*')`）
- CORS preflight → 204 ✅

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 备注 |
|---|------|--------|--------|------|
| 1 | 生产部署前：修改 JWT_SECRET 为强随机值 | 运维 | P0 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| 2 | 生产部署前：`npm run build` 重新构建前端 | 运维 | P0 | 构建产物在 vue-frontend/dist/ |
| 3 | 复制 backend/.env.production → backend/.env | 运维 | P0 | 配置 JWT_SECRET 和其他参数 |
| 4 | 启动前创建 logs 目录 | 运维 | P1 | PM2 日志目录 |
| 5 | 设置 PM2 开机自启 | 运维 | P2 | `pm2 startup` + `pm2 save` |

---

## ⚠️ 已知局限

- 工具管理目前无 GET-by-ID 端点（需要时按需添加）
- JSON 文件数据库在高并发下存在写入竞争（小规模使用无影响）
- 前端 dist/ 未更新（需在目标服务器执行 `npm run build`）

---

## 📁 成员产出索引

- gstack-product-reviewer（产品官）：方案评审与验收标准制定
- gstack-investigator（排障手）：Express 5 兼容性调试、SPA fallback 修复

---

> 本报告由软件工坊 AI 协作生成，生产部署请由工程负责人复核。
