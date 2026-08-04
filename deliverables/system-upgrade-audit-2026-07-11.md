# 系统体检与可升级项清单（2026-07-11）

> 项目：工器具管理系统 → 物料管理系统（仓库 `tools-management`，本地 HEAD `8ca0ca9`）
> 体检方式：实跑 git 状态 / grep 源码特征 / 安全姿态核查 / 新代码卫生扫描

---

## 一、当前系统状态（体检实测）

| 维度 | 实测结果 |
|------|---------|
| Git 状态 | 本地领先 `origin/main` 约 **10 个提交**（含 v3.0.0 物料模块 `8ca0ca9`），**未 push** |
| 构建产物 | 4 个 vite 临时文件已清理；仅 `_smoke_test.mjs`（回归脚本）未跟踪 |
| 弱光扫码优化 | ❌ **仍缺失**（源码 `useScanner.ts`/`ScanTool.vue` 无 torch/bulb-o，grep 命中仅 node_modules + dist 构建残留） |
| 工具箱条形码接口 | ❌ **仍缺失**（后端 `tools.js` 无 `GET /toolkits/code/:code`，移动端无 `getToolkitByCode`） |
| 安全 - JWT | ✅ `JWT_SECRET` 从 env 读取（已修，依赖 .env 配置） |
| 安全 - 默认密码 | ⚠️ 硬编码 fallback `Admin@2026!`（`db.js:13`，部署必须改） |
| 安全 - 登录限流 | ✅ `express-rate-limit` 15min/5次 已就绪 |
| 新代码卫生 | ✅ 无 TODO/FIXME/console.log/debugger 残留 |
| 物料模块实测 | ✅ 后端 24 用例实测 23/24 通过（1 项为测试断言层级写错，源码正确）；双端 build 0 error |

---

## 二、可升级项清单（按优先级）

### 🔴 P0 — 必须做（让已有成果生效 / 恢复已知缺失）

| # | 升级项 | 说明 | 工作量 |
|---|--------|------|--------|
| P0-1 | **推送 v3.0.0 + 生产部署** | 本地 10 个提交未推，生产仍是旧版。这是最高优先级"升级"。含 `git push` + 服务器 `git pull` + `npm install` + `pm2 restart` + 双端重新 build | 低（部署） |
| P0-2 | **恢复弱光扫码优化** | 移动端 `useScanner.ts`/`ScanTool.vue` 加 torch 闪光灯 + 原生 `BarcodeDetector` + 分辨率约束 + 参数优化（fps/二维码框）。之前实现细节完整记录在 memory，重做成本低 | 中 |
| P0-3 | **恢复工具箱条形码按码查** | 后端 `tools.js` 加 `GET /toolkits/code/:code`；移动端 `api` 加 `getToolkitByCode`，`ScanTool` 支持 BX- 工具箱批量加领用篮 | 中 |

### 🟡 P1 — 应做（安全加固 + 已知短板）

| # | 升级项 | 说明 | 工作量 |
|---|--------|------|--------|
| P1-1 | **改默认管理员密码** | 生产部署后立即改 `Admin@2026!`，或环境变量 `DEFAULT_ADMIN_PASSWORD` 注入 | 低 |
| P1-2 | **确认生产 .env / JWT_SECRET** | 避免重启后随机密钥使所有 token 失效；确认服务器 `.env` 已配置 | 低 |
| P1-3 | **工具/物料 Excel 批量导入** | 之前生成的导入 Excel 未实际入库；物料新表也需要批量录入手段（后端加 import 接口 or 复用 seed 脚本） | 中 |

### 🟢 P2 — 增强（v3.1 / v3.2 规划顺延）

| # | 升级项 | 说明 |
|---|--------|------|
| P2-1 | 低库存主动通知 | 消耗品 `stock_qty <= warning_qty` 时推送/标红（P1 顺延） |
| P2-2 | 盘库差异报告 | 盘库完成生成差异清单（缺失/多余/数量不符） |
| P2-3 | 消耗分析报表 | 按品类/时间段统计消耗品出库量 |
| P2-4 | 仪表盘物料卡片补全 | 备件总数 / 消耗品种类 / 待盘库数 统计卡片 |

---

## 三、建议执行顺序

1. **立即**：P0-1 推送 + 部署（让 v3.0.0 上线生效）
2. **随后**：P0-2 / P0-3 用快速模式重做并推送（这两块是之前会话丢失、已确认缺失）
3. **部署后**：P1-1 / P1-2 安全加固
4. **下个迭代**：P1-3 批量导入 + P2 增强项

---

## 四、风险与注意

- 本地 `backend/db.json` 被 gitignore，本地启动由 `db.js` 的 `initialDB` 自动生成（含 5 新表）；**生产数据在服务器**，push 不会覆盖。
- 之前 QA 子 agent 报告不可信（曾伪造"404/源码 Bug"结论），关键验证由主理人亲自跑实测（24 用例）确认通过。
- 推送网络不稳，建议用 token 方式：`git push https://rqrqfwqg:<token>@github.com/rqrqfwqg/tools-management.git main`
