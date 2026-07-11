#!/bin/bash
# ============================================
# 工器具管理系统 - 一键部署脚本
# 用法：bash deploy/production/deploy.sh
# ============================================
set -e

APP_DIR="/opt/tools-management"
echo "🚀 开始部署工器具管理系统..."

# 0. 确保 SSL 证书存在（摄像头扫码需要 HTTPS）
echo ""
echo "🔐 [0/7] 检查 SSL 证书..."
SSL_DIR="/etc/nginx/ssl"
if [ ! -f "$SSL_DIR/tools.crt" ] || [ ! -f "$SSL_DIR/tools.key" ]; then
    echo "   生成自签名 SSL 证书..."
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$SSL_DIR/tools.key" \
        -out "$SSL_DIR/tools.crt" \
        -subj "/CN=tools-management" 2>/dev/null
    echo "   ✅ 自签名证书已生成（浏览器首次访问会提示不安全，点继续即可）"
    echo "   💡 如有域名，建议用 certbot 申请免费证书: certbot certonly --nginx -d yourdomain.com"
else
    echo "   ✅ SSL 证书已存在"
fi

# 1. 拉取最新代码
echo ""
echo "📦 [1/7] 拉取最新代码..."
cd "$APP_DIR"
git pull origin main

# 2. 安装后端依赖
echo ""
echo "📦 [2/7] 安装后端依赖..."
cd "$APP_DIR/backend"
npm install --production

# 3. 构建 PC 前端
echo ""
echo "🔨 [3/7] 构建 PC 前端..."
cd "$APP_DIR/vue-frontend"
npm install --include=dev
npm run build

# 4. 构建移动前端
echo ""
echo "🔨 [4/7] 构建移动前端..."
cd "$APP_DIR/mobile-frontend"
npm install --include=dev
npm run build:prod

# 5. 重启后端
echo ""
echo "🔄 [5/7] 重启后端服务..."
cd "$APP_DIR"
pm2 startOrReload deploy/production/ecosystem.config.js --update-env
pm2 save

# 6. 重载 Nginx（应用新配置）
echo ""
echo "🌐 [6/7] 重载 Nginx..."
nginx -t && nginx -s reload || systemctl restart nginx
echo "   ✅ Nginx 已重载"

# 7. 同步工具数据
echo ""
echo "📊 [7/7] 同步工具数据..."
cd "$APP_DIR"
node deploy/production/import-tools.js

echo ""
echo "✅ ========== 部署完成 =========="
echo "   PC 端:   https://你的服务器IP/"
echo "   手机端:  https://你的服务器IP/m/"
echo "   ⚠️  首次访问浏览器会提示证书不安全，点「高级」→「继续」即可"
echo "   💡 摄像头扫码功能需要 HTTPS 环境"
echo "=================================="
