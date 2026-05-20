# 工器具管理系统 — 上线前全检报告

**日期**：2025-05-10
**场景**：上线前检查（代码审查 + 安全审计 + QA测试）
**参与成员**：产品官 + 安全卫士 + 质量门神

---

## 📌 TL;DR（执行摘要）

- **整体结论**：🔴 **No-Go** — 系统存在可直接被完全接管的严重漏洞，且有 6 项功能级阻断项
- **安全评级**：D（不建议当前状态上线）
- **QA 健康评分**：62/100
- **阻塞项数量**：🔴 Critical 8 项 + 🟠 Major 25 项
- **下一步**：至少修复 2 个安全 Critical + 7 个安全 Major + 6 个 QA 阻断项后方可上线内网环境

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🔴 **No-Go** |
| 严重度分布 | 🔴 8 / 🟠 25 / 🟡 19 / 🟢 3 |
| 关键行动项 | 15 条 |
| 建议负责人 | 后端开发（安全+数据完整性）、前端开发（权限+表单验证）、DevOps（环境变量+部署） |

---

## 1. 各成员核心结论

### 🔍 产品官（代码审查）

- **核心判断**：代码质量中等偏下，架构层面存在多个系统性缺陷。后端单文件 1166 行无模块拆分、前端 TypeScript any 泛滥形同虚设、文件上传功能完全不可用（端口错误+后端无路由）、initDB 数据键名拼写错误导致重建后系统崩溃、Login 绕过 API 层直接 fetch。
- **关键建议**：上线前必须修复 8 个 Critical 项（图片上传/端口错误/数据键名/错误处理/类型定义/权限系统/登录流程），🟠 项可排入迭代但 M-11（路由守卫）、M-15（表单验证）、M-17（环境变量）应优先。

### 🛡️ 安全卫士（OWASP+STRIDE 审计）

- **核心判断**：安全评级 **D**，系统存在可直接被完全接管的严重漏洞。JWT 密钥明文硬编码任何人可伪造管理员 token、默认密码 123456 无暴力破解防护、CORS 完全开放、JSON 文件并发写入无锁可致数据损坏、禁用用户 token 仍有效。
- **关键建议**：至少修复 2 Critical + 7 Major 后方可上线内网。即使内网部署，同网段用户均可利用这些漏洞。Sprint 0（~4h）修复 JWT 密钥外部化 + 默认密码/速率限制。

### ✅ 质量门神（QA测试）

- **核心判断**：健康评分 62/100，发现 29 个 Bug（6 阻塞/12 重要/11 一般）。最严重：initDB 键名 `shelve` vs `shelves` 导致重建崩溃、图片上传完全不可用、删除分类/部门无关联检查、路由守卫无角色权限、订单创建时工具锁定与审批流程语义矛盾。
- **关键建议**：6 项阻塞 Bug 必须上线前修复。🟠 项中登录绕过 auth store（菜单闪烁）、硬编码凭据、表单无验证、角色 user_count 失效应优先处理。

---

## 2. 综合审查发现（去重合并后按严重度排序）

### 🔴 Critical（8项，上线阻断）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源成员 |
|---|--------|------|------|---------|------|---------|
| 1 | 🔴 | 安全 | server.js:11 | JWT_SECRET 硬编码为 `your-secret-key-change-in-production`，任何人可伪造管理员 token | 移入环境变量 + 生成强随机密钥 | 安全卫士 |
| 2 | 🔴 | 安全 | server.js:29,257,316 | 默认密码 123456 + 登录无速率限制 + 无暴力破解防护 | 强制首次修改密码 + 登录速率限制 + 密码复杂度策略 | 安全卫士 |
| 3 | 🔴 | 数据完整性 | server.js:62 vs 575+ | initDB 用 `shelve`（单数），API 全部用 `shelves`（复数），删除 db.json 重建后货架功能全部崩溃 | initDB 中 `shelve` 改为 `shelves` | 产品官+质量门神 |
| 4 | 🔴 | 功能 | ToolManagement.vue:159,251 + server.js | 图片上传功能完全不可用：前端端口 8000 错误（应为 3000）+ 后端无 upload-image 路由 | 后端添加 upload-image 路由 + 前端修复端口或移除上传功能 | 产品官+质量门神 |
| 5 | 🔴 | 功能 | server.js:908-920 | 删除分类不检查关联工具，导致工具 category_name 悬空引用 | 删除前检查 db.tools 中是否有引用该分类的工具 | 质量门神 |
| 6 | 🔴 | 功能 | server.js:404-416 | 删除部门不检查关联用户，导致用户 dept_id 悬空引用 | 删除前检查 db.users 中是否有引用该部门的用户 | 质量门神 |
| 7 | 🔴 | 权限 | router/index.ts:30-38 | 路由守卫仅检查 token 存在性，无角色权限检查，staff 可直接访问 /users 等管理页面 | 路由 meta 声明所需角色，beforeEach 中校验 authStore.role | 产品官+质量门神 |
| 8 | 🔴 | 业务逻辑 | server.js:988,1001-1006 | 创建订单时工具立即标记为 borrowed，但订单状态为 pending，审批语义矛盾 | 审批制应在批准时才锁定工具，或直接领用制初始状态为 borrowed | 质量门神 |

### 🟠 Major（25项，应尽快修复）

| # | 严重度 | 类别 | 位置 | 问题描述 | 来源成员 |
|---|--------|------|------|---------|---------|
| 9 | 🟠 | 安全 | server.js:14 | CORS 完全开放 `cors()` 无限制 | 安全卫士 |
| 10 | 🟠 | 安全 | server.js:121-129 | readDB/writeDB 无异常保护，db.json 损坏则服务器崩溃 | 安全卫士+产品官 |
| 11 | 🟠 | 安全 | server.js:132-144 | 禁用用户 JWT 仍有效，authenticate 不检查 is_active | 安全卫士 |
| 12 | 🟠 | 安全 | auth.ts:14 | JWT 存储在 localStorage，XSS 可窃取 | 安全卫士 |
| 13 | 🟠 | 安全 | server.js 全局 | 无安全响应头（CSP/X-Frame-Options/HSTS） | 安全卫士 |
| 14 | 🟠 | 安全 | server.js:15-16 | 无请求体大小限制，可内存耗尽 DoS | 安全卫士 |
| 15 | 🟠 | 安全 | db.json + .gitignore | db.json 含密码哈希被纳入版本控制 | 安全卫士 |
| 16 | 🟠 | 认证 | Login.vue:49-77 | 登录绕过 auth store，角色信息延迟加载致菜单闪烁 | 产品官+质量门神 |
| 17 | 🟠 | 认证 | Login.vue:33 | 登录表单硬编码 admin/123456 | 质量门神 |
| 18 | 🟠 | 代码质量 | ToolManagement.vue:159, OrderManagement.vue:190 | getImageUrl 端口错误（8000 vs 3000），图片加载失败 | 产品官+质量门神 |
| 19 | 🟠 | 代码质量 | server.js 全文 1166行 | 单文件无模块拆分 | 产品官 |
| 20 | 🟠 | 代码质量 | 6个 CRUD 视图 | 高度重复的 load/openDialog/handleSave/handleDelete 逻辑 | 产品官 |
| 21 | 🟠 | 数据 | server.js:421-424 + RoleManagement.vue:10 | 角色 user_count 后端不返回，前端始终为空 | 产品官+质量门神 |
| 22 | 🟠 | 数据 | server.js:297-305 | 更新用户角色时 role_id 不同步 | 质量门神 |
| 23 | 🟠 | 类型 | api/index.ts + views/*.vue | TypeScript any 泛滥，类型安全形同虚设 | 产品官 |
| 24 | 🟠 | 类型 | types/index.ts:29-44 | Tool 接口缺少 warehouse_id/shelf_id/storage_location_id | 产品官 |
| 25 | 🟠 | 类型 | types/index.ts:82-91 | DashboardStats 接口与后端响应严重不匹配 | 产品官 |
| 26 | 🟠 | 表单 | UserManagement.vue:27-64 | 用户管理表单无必填字段验证 | 质量门神 |
| 27 | 🟠 | 表单 | ToolManagement.vue:54-89 | 工具管理表单无必填字段验证 | 质量门神 |
| 28 | 🟠 | 权限 | ToolManagement.vue:5,35,47 | 新增/编辑/删除按钮不区分角色 | 质量门神 |
| 29 | 🟠 | 权限 | OrderManagement.vue:66-67 | 批准/拒绝按钮不区分用户角色 | 质量门神 |
| 30 | 🟠 | 功能 | OrderManagement.vue:70 | 订单删除按钮对任何状态都显示 | 质量门神 |
| 31 | 🟠 | 功能 | server.js:946-1012 | 并发借出同一工具可能成功，JSON 文件 DB 无事务保护 | 质量门神 |
| 32 | 🟠 | 功能 | ChangePassword.vue:92-94 | 修改密码后不强制重新登录，旧 token 继续有效 | 质量门神 |
| 33 | 🟠 | 架构 | server.js 全部 GET 路由 | 列表接口无分页/搜索/排序 | 产品官 |

### 🟡 Minor（19项，建议修复）

| # | 问题 | 位置 | 来源 |
|---|------|------|------|
| 34 | Token 过期后不提示用户 | api/index.ts:21-26 | 质量门神 |
| 35 | 路由守卫只检查 token 存在性不验证有效性 | router/index.ts:31 | 质量门神 |
| 36 | 登出后无服务端 token 失效机制（JWT 无状态） | server.js 全局 | 质量门神 |
| 37 | 编辑工具不校验货架是否属于所选仓库 | server.js:806-837 | 质量门神 |
| 38 | 部门管理表单无必填字段验证 | DeptManagement.vue:17-27 | 质量门神 |
| 39 | 部门和角色查询接口对普通用户开放 | server.js:355,421 | 质量门神 |
| 40 | 打印区域 setTimeout 竞态条件 | OrderManagement.vue:216-230 | 质量门神+产品官 |
| 41 | 订单 item_id 随机数可能重复 | server.js:975 | 质量门神 |
| 42 | Dashboard 前后端数据类型不匹配 | types/index.ts vs server.js | 质量门神+产品官 |
| 43 | 购物车 quantity 逻辑误导 | cart.ts:13-14 | 质量门神+产品官 |
| 44 | 管理员可将自身角色改为 staff | server.js:297-305 | 质量门神 |
| 45 | Login.vue 残留 7 处 console.log | Login.vue:36-79 | 产品官 |
| 46 | MainLayout.vue 导入未使用 ComponentSize | MainLayout.vue:91 | 产品官 |
| 47 | Login.vue formRef 未使用 | Login.vue:31 | 产品官 |
| 48 | 登录接口编码格式与其他接口不一致 | api/index.ts:31-33 | 产品官 |
| 49 | API 路径命名风格不一致 | server.js | 产品官 |
| 50 | 默认密码 123456 硬编码多处 | server.js:29,41,257,316 | 产品官 |
| 51 | Dashboard 只展示 4/9 个指标 | Dashboard.vue:19-24 | 产品官 |
| 52 | 零审计日志，操作无法追溯 | server.js 全局 | 安全卫士 |

---

## 3. STRIDE 威胁模型摘要

| 威胁类型 | 严重度 | 关键发现 |
|---------|--------|---------|
| Spoofing（欺骗） | 🔴 | JWT 可伪造，默认密码可暴力破解 |
| Tampering（篡改） | 🟠 | 并发写入无锁，CORS 开放 |
| Repudiation（抵赖） | 🟡 | 零审计日志 |
| Info Disclosure（信息泄露） | 🟠 | 密码哈希入库版本控制，localStorage token 可被 XSS 窃取 |
| DoS（拒绝服务） | 🟠 | 无速率限制 + 无请求体限制 + Math.max 栈溢出 |
| Elevation（提权） | 🔴 | 伪造 JWT role=admin 即获全部权限，路由守卫无角色检查 |

---

## 4. 阻塞项清单（上线前必须修复）

| # | 阻塞项 | 预估工时 | 负责方 |
|---|--------|---------|--------|
| 1 | F-001: JWT 密钥移入环境变量 + 强随机密钥 | 0.5h | 后端 |
| 2 | F-002: 移除默认密码 + 登录速率限制 + 密码复杂度 | 1.5h | 后端 |
| 3 | initDB `shelve` → `shelves` 键名修复 | 0.1h | 后端 |
| 4 | 图片上传：修复端口 8000→3000 + 后端添加路由（或移除上传功能） | 2h | 前后端 |
| 5 | 删除分类/部门前关联检查 | 1h | 后端 |
| 6 | 路由守卫增加角色权限检查 | 1h | 前端 |
| 7 | 订单创建-工具锁定策略明确化 | 1h | 后端 |
| 8 | 后端全局错误处理中间件 + readDB/writeDB 异常保护 | 1h | 后端 |

**阻塞项总工时估算：~8h**

---

## 5. 回滚预案

当前系统为首次上线，无历史版本，回滚策略：
- **数据库**：db.json 为文件数据库，上线前做一份备份（`cp db.json db.json.bak`）
- **代码**：已推送到 GitHub（https://github.com/rqrqfwqg/tools-management），可通过 `git revert` 回退
- **前端**：Vite dev 模式运行，无构建产物，重启即可回退代码版本
- **后端**：Node.js 进程，`git checkout` 后重启即可

---

## ✅ 行动清单（15条具体可执行项）

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | JWT_SECRET 移入 .env，生成 32 字节随机密钥 | 后端 | P0 | 上线前 |
| 2 | 登录端点添加速率限制（express-rate-limit，15分钟5次） | 后端 | P0 | 上线前 |
| 3 | 新建用户强制设置密码，重置密码生成随机临时密码 | 后端 | P0 | 上线前 |
| 4 | initDB 中 `shelve:` 改为 `shelves:` | 后端 | P0 | 上线前 |
| 5 | 后端添加全局错误处理中间件 | 后端 | P0 | 上线前 |
| 6 | readDB/writeDB 添加 try/catch，损坏时返回 500 而非崩溃 | 后端 | P0 | 上线前 |
| 7 | 删除分类前检查关联工具，删除部门前检查关联用户 | 后端 | P0 | 上线前 |
| 8 | 路由 meta 标记管理员路由，beforeEach 检查 authStore.role | 前端 | P0 | 上线前 |
| 9 | 修复图片端口 8000→3000，或提取为 composable + 环境变量 | 前端 | P0 | 上线前 |
| 10 | 图片上传：后端添加 upload-image 路由（multer）或前端移除上传入口 | 前后端 | P1 | Sprint 1 |
| 11 | Login.vue 改用 authStore.login()，移除直接 fetch | 前端 | P1 | Sprint 1 |
| 12 | CORS 限制为前端域名 | 后端 | P1 | Sprint 1 |
| 13 | 添加安全响应头（helmet 中间件） | 后端 | P1 | Sprint 1 |
| 14 | 所有表单添加必填字段验证规则 | 前端 | P1 | Sprint 1 |
| 15 | 订单创建-工具锁定策略明确：审批制则批准时锁定，领用制则状态为 borrowed | 后端 | P1 | Sprint 1 |

---

## ⚠️ 待完善 / 已知局限

- 本报告基于静态代码审查，未执行实际运行时测试
- 安全审计未进行实际渗透测试，结论基于代码层面分析
- JSON 文件数据库的并发安全问题是架构级局限，短期无法根治（需迁移到 SQLite/PostgreSQL）
- JWT 无状态特性导致登出后 token 仍有效，需引入 token 黑名单机制
- 权限系统当前仅有 admin/staff 二元区分，permission_ids 字段已定义但未实现
- 前端 TypeScript 类型定义大面积使用 any，类型安全需逐步补全

---

## 📚 成员产出索引

- gstack-product-reviewer（产品官）原始产出：31 项发现（8 Critical / 10 Major / 8 Minor / 5 Info），覆盖代码质量/架构/错误处理/类型安全/前后端一致性/功能完整性/可维护性
- gstack-security-officer（安全卫士）原始产出：17 项发现（2 Critical / 7 Major / 5 Minor / 3 Info），覆盖 OWASP Top 10 + STRIDE 全量审计
- gstack-qa-lead（质量门神）原始产出：29 项 Bug（6 阻塞 / 12 重要 / 11 一般），覆盖认证/CRUD/订单/打印/权限/边界条件 7 大测试域

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。
