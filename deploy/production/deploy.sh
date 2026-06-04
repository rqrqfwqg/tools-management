#!/bin/bash
# ============================================
# 工器具管理系统 - 一键部署脚本
# 用法：bash deploy/production/deploy.sh
# ============================================
set -e

APP_DIR="/opt/tools-management"
echo "🚀 开始部署工器具管理系统..."

# 1. 拉取最新代码
echo ""
echo "📦 [1/5] 拉取最新代码..."
cd "$APP_DIR"
git pull origin main

# 2. 安装后端依赖
echo ""
echo "📦 [2/5] 安装后端依赖..."
cd "$APP_DIR/backend"
npm install --production

# 3. 构建 PC 前端
echo ""
echo "🔨 [3/5] 构建 PC 前端..."
cd "$APP_DIR/vue-frontend"
npm install
npm run build

# 4. 构建移动前端
echo ""
echo "🔨 [4/5] 构建移动前端..."
cd "$APP_DIR/mobile-frontend"
npm install
npm run build:prod

# 5. 重启后端服务
echo ""
echo "🔄 [5/5] 重启后端服务..."
cd "$APP_DIR"
pm2 startOrReload deploy/production/ecosystem.config.js --update-env
pm2 save

echo ""
echo "✅ ========== 部署完成 =========="
echo "   PC 端: http://你的服务器IP/"
echo "   手机端: http://你的服务器IP/m/"
echo "=================================="
