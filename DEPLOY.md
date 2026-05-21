# 工器具管理系统 - 部署指南

## 一、环境准备

在其他电脑上部署，需要先安装：

### 1. 安装 Node.js（必须）

去 https://nodejs.org 下载 **LTS 版本**（18.x 或以上），一路下一步安装即可。

验证安装：
```bash
node -v    # 应显示 v18.x.x 或更高
npm -v     # 应显示 9.x.x 或更高
```

### 2. 安装 PM2（进程管理，推荐）

打开命令提示符（Win+R → cmd），执行：
```bash
npm install -g pm2
```

> PM2 能让系统在后台运行，崩溃自动重启，开机也能自启。生产环境必备。

---

## 二、获取代码

**方式一：从 GitHub 克隆（推荐）**

```bash
git clone https://github.com/rqrqfwqg/tools-management.git
cd tools-management
```

**方式二：U盘拷贝整个项目文件夹**

直接把 `tools-management` 文件夹复制到目标电脑即可。

---

## 三、安装依赖 + 构建

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 安装前端依赖
cd ../vue-frontend
npm install

# 3. 构建前端（生成 dist 目录）
npm run build

# 4. 回到项目根目录
cd ..
```

> `npm run build` 会把 Vue 前端编译成静态文件，输出到 `vue-frontend/dist/`，后端会自动加载。

---

## 四、配置环境变量

```bash
cd backend
```

编辑 `.env` 文件，**必须修改 JWT_SECRET**：

```env
PORT=3000
JWT_SECRET=改成随机字符串
NODE_ENV=production
```

**生成随机 JWT 密钥：**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

把输出的那一串复制，替换 `JWT_SECRET=` 后面的值。

---

## 五、启动服务

回到项目根目录，用 PM2 启动：

```bash
cd ..
mkdir -p logs
pm2 start ecosystem.config.js --env production
```

验证是否启动成功：
```bash
pm2 status
```

应该看到 `tools-management` 状态为 `online`。

---

## 六、设置开机自启（可选但推荐）

```bash
pm2 startup      # 按提示复制执行那行命令
pm2 save         # 保存当前进程列表
```

---

## 七、访问系统

### 本机访问
```
http://localhost:3000
```

### 局域网其他电脑访问
```
http://<本机IP>:3000
```

查看本机 IP：
```bash
ipconfig | findstr IPv4
```

**⚠️ 防火墙提醒：** 如果局域网其他电脑访问不了，需要在 Windows 防火墙中放行 3000 端口：
1. 打开「Windows 防火墙」→「高级设置」
2. 新建入站规则 → 端口 → TCP → 3000 → 允许连接
3. 完成

---

## 八、更新部署（后续代码更新时）

```bash
# 拉取最新代码
git pull

# 重新构建前端
cd vue-frontend && npm run build && cd ..

# 重启服务即可
pm2 restart tools-management
```

---

## 九、PM2 常用命令

| 命令 | 用途 |
|------|------|
| `pm2 status` | 查看所有服务状态 |
| `pm2 logs tools-management` | 查看实时日志 |
| `pm2 restart tools-management` | 重启服务 |
| `pm2 stop tools-management` | 停止服务 |
| `pm2 start ecosystem.config.js` | 启动服务 |
| `pm2 delete tools-management` | 删除服务（重装时用） |

---

## 十、默认管理员账号

| 项目 | 值 |
|------|-----|
| 手机号 | 13570383740 |
| 密码 | 518623 |
| 账号 | yanzijian |

> 首次部署后请尽快修改默认密码。

---

## 十一、常见问题

### Q: 端口 3000 被占用？
```bash
netstat -ano | findstr 3000   # 查看是谁占用
taskkill /PID <进程ID> /F     # 强制结束
```

### Q: npm install 报错？
- 检查 Node.js 版本是否 >= 18
- 尝试 `npm cache clean --force` 后重试
- 如果是公司网络，可能需要配置 npm 镜像：
  ```bash
  npm config set registry https://registry.npmmirror.com
  ```

### Q: 前端页面空白？
- 确认已经执行过 `npm run build`
- 确认 `vue-frontend/dist/` 目录存在

### Q: PM2 启动后马上 crash？
```bash
pm2 logs tools-management --lines 50   # 查看错误日志
```
