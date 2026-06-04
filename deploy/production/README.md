# 🚀 工器具管理系统 — 云端部署手册

> 适用：腾讯云轻量应用服务器（Ubuntu 22.04 + Node.js 应用镜像）
> 耗时：首次部署约 10 分钟，后续更新 1 分钟

---

## 一、服务器准备（一次性，5 分钟）

### 1.1 SSH 登录服务器

```bash
# 在腾讯云控制台找到你的公网 IP，Windows 用 PowerShell / CMD：
ssh root@你的服务器公网IP
```

### 1.2 防火墙放行端口

打开腾讯云控制台 → 轻量应用服务器 → 防火墙 → 添加规则：

| 端口 | 协议 | 说明 |
|------|------|------|
| 80 | TCP | HTTP 网站访问 |
| 443 | TCP | HTTPS（后续配 SSL） |
| 3000 | TCP | 后端 API（仅调试用，后续可关） |

### 1.3 确认基础环境

```bash
node -v      # 应该 ≥ 18
npm -v       # 应该 ≥ 9
nginx -v     # Node.js 镜像自带 nginx
git --version
```

> 如果 nginx 没装：`apt update && apt install -y nginx`

### 1.4 创建项目目录

```bash
mkdir -p /opt/tools-management/logs
chown -R $USER:$USER /opt/tools-management
```

---

## 二、拉取代码并部署（核心步骤）

### 2.1 克隆仓库

```bash
cd /opt/tools-management && git clone https://github.com/rqrqfwqg/tools-management.git .
```

### 2.2 配置后端环境变量

```bash
cd /opt/tools-management/backend

# 生成 .env 文件
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
JWT_SECRET=$(openssl rand -hex 32)
EOF
```

> 或者手动创建 `.env`，JWT_SECRET 写一个随机字符串。

### 2.3 一键部署

```bash
cd /opt/tools-management
chmod +x deploy/production/deploy.sh
bash deploy/production/deploy.sh
```

这会自动完成：
- 安装后端依赖
- 构建 PC 前端和移动前端静态文件
- 启动后端（PM2）

---

## 三、配置 Nginx

### 3.1 复制配置文件

```bash
cp /opt/tools-management/deploy/production/nginx.conf /etc/nginx/sites-available/tools
ln -sf /etc/nginx/sites-available/tools /etc/nginx/sites-enabled/
```

### 3.2 删掉默认站点（避免冲突）

```bash
rm -f /etc/nginx/sites-enabled/default
```

### 3.3 测试并重载

```bash
nginx -t                # 检查配置语法
systemctl reload nginx  # 重载生效
```

---

## 四、PM2 开机自启

```bash
pm2 startup systemd
# 执行它输出的那行 sudo 命令
pm2 save
```

---

## 五、验证部署

用浏览器访问：

```
http://你的公网IP/        → PC 端
http://你的公网IP/m/      → 手机端
http://你的公网IP/api/dashboard  → 应该返回 JSON 数据
```

登录：用已创建的管理员账号（如 `yanzijian` / `13570383740` / 密码 `518623`）

---

## 六、日常更新（以后每次改代码后）

```bash
cd /opt/tools-management
bash deploy/production/deploy.sh
```

一行命令搞定，约 30 秒完成。

---

## 七、架构说明

```
用户浏览器
    │
    ▼
┌─────────────────────────────────┐
│  Nginx (端口 80)                │
│                                 │
│  /          → PC 前端静态文件    │
│  /m/        → 手机前端静态文件   │
│  /api/*     → 后端 127.0.0.1:3000 │
│  /uploads/* → 图片文件          │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ PM2 管理        │
│ tools-backend   │
│ (端口 3000)     │
│ Node.js Express │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ db.json         │
│ (JSON 数据库)   │
└─────────────────┘
```

---

## 八、常见问题

### Q: 访问页面空白？
A: 浏览器 F12 → Console 看报错。最常见原因：nginx 没 reload 或前端 dist 没构建成功。

### Q: 登录没反应？
A: 检查后端是否在跑：`pm2 status`。如果没启动：`cd /opt/tools-management && pm2 start deploy/production/ecosystem.config.js`

### Q: 图片上传失败？
A: 确认 `/opt/tools-management/backend/uploads/` 目录存在且有写入权限。

### Q: 怎么配 HTTPS/域名？
A: 等域名备案完成后告诉我，我帮你配 SSL 证书（腾讯云免费提供）。
