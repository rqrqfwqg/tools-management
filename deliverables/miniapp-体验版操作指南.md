# 工器具小程序 · 免域名真机调试指南（公网服务器 / 局域网）

> 适用场景：还没买域名 / 没做 ICP 备案，想先让真机跑起来自测、或内部人体验。
> 核心原理：微信开发者工具「真机调试 / 预览」（开发版）支持「不校验合法域名」开关，
> 小程序可直连后端（HTTP / IP），从而绕开域名备案。
> 两种连法：① 公网服务器（云调试，手机走任意网络）；② 本机局域网（手机需连同 WiFi）。
>
> ⚠️ 注意：「上传 → 体验版 / 线上版」会强制校验 request 合法域名，HTTP/IP 不行，
> 那一步必须等 ICP 备案 + HTTPS 合法域名。本文档只覆盖"免域名调试"。

---

## 一、已帮你准备好的

| 项 | 状态 |
|----|------|
| `miniapp/.env.development` | ✅ API = `http://82.156.62.59:3300/api`（公网调试，dev 构建） |
| `miniapp/.env.experience` | ✅ API = `http://82.156.62.59:3300/api`（公网调试，exp 构建；含局域网切换注释） |
| `miniapp/package.json` | ✅ 含 `dev:mp-weixin` / `build:mp-weixin` / `dev:mp-weixin:exp` / `build:mp-weixin:exp` |
| 后端多端口网关 | ✅ `backend/server.js` 支持 `HOST` 变量（3300 用 `0.0.0.0`）；PM2 `tools-backend-miniapp` |

> 2026-08-10 实测：服务器 `82.156.62.59` 在线（80 端口正常），但 **3300 端口被腾讯云安全组挡掉**
> （3300、3000 均超时，仅 80/443 通）。公网真机调试前必须先放行 3300，见方式一步骤 1。

---

## 二、方式一：公网服务器真机调试（云调试，当前推荐）

手机不挑网络，只要能上公网就能连 `82.156.62.59:3300`。无需本机开机、无需同一 WiFi。

### 步骤 1 ｜ 腾讯云安全组放行 3300（关键阻塞点）
1. 腾讯云控制台 → 云服务器 CVM → **安全组** → 找到实例绑定的安全组
2. **入站规则 → 添加规则**：
   - 协议端口：`TCP:3300`
   - 来源：`0.0.0.0/0`（调试期；上线后可收紧为特定 IP 或删掉）
   - 策略：允许
3. 保存。若服务器本身还跑了 `ufw` / `iptables`，也需放行：
   ```bash
   sudo ufw allow 3300
   ```
4. 在你本机验证放行是否生效：
   ```bash
   curl -m 8 -o /dev/null -w "HTTP %{http_code}\n" http://82.156.62.59:3300/api/health
   ```
   返回 `200` 即成功；仍 `000` 表示安全组/防火墙还没放开。

### 步骤 2 ｜ 确认服务器后端在跑
登录服务器执行：
```bash
pm2 list                       # 看 tools-backend-miniapp 是否 online
pm2 logs tools-backend-miniapp
```
确保它监听 `0.0.0.0:3300`（`HOST=0.0.0.0`）。若没起：
```bash
cd /path/to/tools-management
HOST=0.0.0.0 PORT=3300 pm2 start ecosystem.config.js --only tools-backend-miniapp
```

### 步骤 3 ｜ 编译开发版（吃 .env.development → 公网 IP）
```bash
cd miniapp
npm run dev:mp-weixin
```
产物在 `miniapp/dist/dev/mp-weixin`。

### 步骤 4 ｜ 开发者工具导入 + 勾选不校验
1. 「导入项目」→ 目录 `miniapp/dist/dev/mp-weixin`，AppID `wx43639b45152d6754`
2. 详情 → 本地设置 → 勾选 **✅ 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书**

### 步骤 5 ｜ 真机调试
点工具栏「真机调试」→ 手机微信扫码。手机请求会直连 `http://82.156.62.59:3300/api`。
若仍报域名错：手机里打开小程序 → 右上「···」→ **打开调试** → 确定 → 重开小程序。

---

## 三、方式二：本机局域网真机调试（无公网服务器也能用）

后端跑在你本机，手机需与电脑连同一个 WiFi。

### 步骤 1 ｜ 启动后端（监听 0.0.0.0）
```bash
cd C:\Users\yan\WorkBuddy\2026-05-10-task-6
PORT=3300 HOST=0.0.0.0 node backend/server.js
```
验证：`curl http://127.0.0.1:3300/api/health` 返回 `{status:"ok"}`。

### 步骤 2 ｜ 放行 Windows 防火墙 3300 入站
控制面板 → Windows Defender 防火墙 → 高级设置 → 入站规则 → 新建规则 →
端口 → TCP 3300 → 允许连接 → 全部勾选 → 命名 `miniapp-3300`。

### 步骤 3 ｜ 改用局域网 IP 编译
当前 `.env.experience` 指向公网 IP；局域网调试请把里面的 IP 改成电脑「手机所连 WiFi 网卡」的 IPv4
（PowerShell 查：`Get-NetIPAddress -AddressFamily IPv4`，常见如 `192.168.3.4`）。改完重编：
```bash
npm --prefix miniapp run dev:mp-weixin:exp
```

### 步骤 4 ｜ 开发者工具导入 + 不校验 + 真机调试
同方式一步骤 4-5（导入 `miniapp/dist/dev/mp-weixin`，目录相同）。

---

## 四、重要注意事项

1. **只有「真机调试 / 预览」（开发版）能免域名**：走「上传 → 体验版」二维码，真机会校验
   request 合法域名，HTTP/IP 会被拒。内部人体验最稳的是用开发者工具的「预览 / 真机调试」码。

2. **公网 3300 仅调试用**：明文 HTTP 暴露公网仅供自测；正式上线走 nginx HTTPS(443) → 内网 3300，
   并配好 HTTPS 合法域名。调试完建议收紧安全组来源（或临时删除规则）。

3. **数据持久化**：后端用 `db.json` 文件存储，服务器/本机运行数据在本地，换机/重装会丢。
   正式上线需挂持久卷（云托管或自建均同）。

4. **想真正对外获客**：仍需域名 + ICP 备案，或改用微信云托管（免备案）。
   前端代码不用重写，只改 `.env.production` 的 API 地址 + 小程序后台配置合法域名。

---

## 五、常用命令速查

```bash
# 公网调试（dev 构建，吃 .env.development）
npm --prefix miniapp run dev:mp-weixin

# 局域网体验版（exp 构建，吃 .env.experience，需先把 IP 改成局域网地址）
npm --prefix miniapp run dev:mp-weixin:exp
npm --prefix miniapp run build:mp-weixin:exp   # 上传用正式构建

# 后端 0.0.0.0 启动
PORT=3300 HOST=0.0.0.0 node backend/server.js

# 验证公网端口放行（返回 200 即成功）
curl -m 8 -o /dev/null -w "HTTP %{http_code}\n" http://82.156.62.59:3300/api/health
```
