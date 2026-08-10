#!/bin/bash
# ==========================================
# 工器具管理系统 - 云端一键部署脚本
# 在腾讯云网页终端中一次性执行
# ==========================================
set -e

echo "=========================================="
echo " 工器具管理系统 - 云端部署"
echo " 时间: $(date)"
echo "=========================================="
echo ""

# -------- 第1步：安装依赖 --------
echo "[1/6] 安装 nginx 和 PM2..."

# 找到 npm 完整路径（sudo 不继承用户 PATH）
NPM=$(which npm)
NODE=$(which node)

# 确保 nginx 已安装
if ! command -v nginx &>/dev/null; then
    sudo apt update -qq
    sudo apt install -y nginx
fi

# 用环境穿透方式安装 PM2
if ! command -v pm2 &>/dev/null; then
    sudo env "PATH=$PATH" "$NPM" install -g pm2
fi

echo "✅ nginx 和 PM2 安装完成"
echo ""

# -------- 第2步：克隆代码 --------
echo "[2/6] 克隆项目代码..."
sudo rm -rf /opt/tools-management
sudo mkdir -p /opt/tools-management
sudo chown ubuntu:ubuntu /opt/tools-management
cd /opt/tools-management
git clone https://github.com/rqrqfwqg/tools-management.git .
echo "✅ 代码克隆完成"
echo ""

# -------- 第3步：安装后端依赖 --------
echo "[3/6] 安装后端依赖..."
cd /opt/tools-management/backend
npm install
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3300
CORS_ORIGIN=*
JWT_SECRET=tools2024securekeychangeinproduction
ENVEOF
echo "✅ 后端依赖安装完成"
echo ""

# -------- 第4步：安装前端依赖并构建 --------
echo "[4/6] 安装 PC 前端依赖并构建..."
cd /opt/tools-management/vue-frontend
npm install --include=dev
npm run build
echo "✅ PC 前端构建完成"

echo ""
echo "[5/6] 安装移动端依赖并构建..."
cd /opt/tools-management/mobile-frontend
npm install --include=dev
npm run build:prod
echo "✅ 移动端构建完成"
echo ""

# -------- 第6步：配置 nginx 并启动 --------
echo "[6/6] 配置 nginx 并启动服务..."

# 创建 nginx 配置
sudo tee /etc/nginx/sites-available/tools > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    # PC 前端
    location / {
        root /opt/tools-management/vue-frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 移动端前端
    location /m {
        alias /opt/tools-management/mobile-frontend/dist;
        index index.html;
        try_files $uri $uri/ /m/index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3300/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 上传文件
    location /uploads/ {
        proxy_pass http://127.0.0.1:3300/uploads/;
        proxy_set_header Host $host;
    }

    # gzip 优化
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}
NGINXEOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/tools /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重载 nginx
sudo nginx -t
sudo systemctl reload nginx
echo "✅ Nginx 配置完成"

# -------- 启动 PM2 --------
cd /opt/tools-management

# 确保找到 pm2（全局安装路径可能不在 sudo 的 PATH 里）
PM2=$(which pm2 2>/dev/null || echo "$(dirname "$NPM")/pm2")
echo "PM2 路径: $PM2"

"$PM2" start deploy/production/ecosystem.config.js
"$PM2" save
"$PM2" startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true
echo "✅ PM2 启动完成"
echo ""

# -------- 检查状态 --------
echo "=========================================="
echo " 部署完成！状态检查："
echo "=========================================="
echo ""
echo "PM2 进程："
"$PM2" status
echo ""
echo "Nginx："
sudo systemctl status nginx --no-pager -l | head -5
echo ""
echo "=========================================="
echo " 🎉 部署成功！"
echo " PC 端:    http://82.156.62.59"
echo " 手机端:   http://82.156.62.59/m"
echo "=========================================="
