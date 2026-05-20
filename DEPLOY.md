# 工器具管理系统 - 部署指南

## 环境要求

- Node.js 18+
- PM2 (`npm install -g pm2`)
- 端口 3000 开放

## 部署步骤

### 1. 安装依赖

```bash
# 前端依赖
cd vue-frontend
npm install

# 后端依赖
cd ../backend
npm install
```

### 2. 构建前端

```bash
cd vue-frontend
npm run build
```

构建产物将输出到 `vue-frontend/dist/` 目录。

### 3. 配置生产环境

```bash
cd ../backend

# 复制生产环境配置
cp .env.production .env

# 编辑 .env，修改 JWT_SECRET
# 生成方法：
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 启动服务

```bash
# 返回项目根目录
cd ..

# 创建日志目录
mkdir -p logs

# 使用 PM2 启动（生产模式）
pm2 start ecosystem.config.js --env production
```

### 5. 验证部署

```bash
# 检查服务状态
pm2 status

# 查看日志
pm2 logs tools-management

# 访问首页
curl http://localhost:3000

# 访问 API
curl http://localhost:3000/api/dashboard -H "Authorization: Bearer <token>"
```

## PM2 常用命令

```bash
pm2 status                    # 查看服务状态
pm2 logs tools-management      # 查看实时日志
pm2 restart tools-management   # 重启服务
pm2 stop tools-management      # 停止服务
pm2 delete tools-management    # 删除服务
pm2 startup                    # 设置开机自启
pm2 save                       # 保存当前进程列表
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建前端
cd vue-frontend && npm run build && cd ..

# 重启服务
pm2 restart tools-management
```

## 生产检查清单

- [ ] 已修改 `JWT_SECRET` 为强随机值
- [ ] 已删除 `backend/.env` 中的默认凭据
- [ ] `NODE_ENV` 设置为 `production`
- [ ] 防火墙/安全组已开放端口 3000
- [ ] 已设置 PM2 开机自启 (`pm2 startup` + `pm2 save`)
