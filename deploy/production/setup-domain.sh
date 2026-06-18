#!/bin/bash
# ============================================
# 工器具管理系统 - 域名 + SSL 一键配置脚本
# 前提：域名已备案、DNS 已解析到本服务器
# 用法：sudo bash deploy/production/setup-domain.sh yourdomain.com
# ============================================
set -e

DOMAIN=${1:-}

if [ -z "$DOMAIN" ]; then
    echo "❌ 用法: sudo bash deploy/production/setup-domain.sh yourdomain.com"
    echo "   示例: sudo bash deploy/production/setup-domain.sh toolgear.com"
    exit 1
fi

APP_DIR="/opt/tools-management"

echo "🚀 开始配置域名: $DOMAIN"
echo ""

# ---------- 0. 安装 Certbot ----------
echo "📦 [1/5] 安装 Certbot..."
if ! command -v certbot &> /dev/null; then
    apt update -qq && apt install -y -qq certbot python3-certbot-nginx
else
    echo "   ✅ Certbot 已安装"
fi

# ---------- 1. 准备验证目录 ----------
echo "📁 [2/5] 准备 Let's Encrypt 验证目录..."
mkdir -p /var/www/certbot
chown www-data:www-data /var/www/certbot

# ---------- 2. 生成 Nginx 域名配置（先 HTTP-only 模式） ----------
echo "⚙️ [3/5] 生成 Nginx 配置（HTTP 模式，供证书验证用）..."
# 替换域名占位符
sed "s/YOUR_DOMAIN.com/$DOMAIN/g" "$APP_DIR/deploy/production/nginx-domain.conf" > /tmp/tools-ssl.conf

# 临时注释掉 443 SSL 块，只保留 80 端口块（让 certbot 验证通过）
# 用 awk 删除 443 server 块
awk '/^# ---------- HTTPS/{skip=1} skip{if(/^}/){skip=0;next};next} {print}' /tmp/tools-ssl.conf > /tmp/tools-http-only.conf

# 移除旧的默认配置，写入临时 HTTP 配置
rm -f /etc/nginx/conf.d/default.conf
cp /tmp/tools-http-only.conf /etc/nginx/conf.d/tools-management.conf

# 同时移除 nginx.conf 里旧的 server 块（如果有）
# 检查并注释掉 /etc/nginx/nginx.conf 中的默认 server
if grep -q "server_name _" /etc/nginx/sites-enabled/default 2>/dev/null; then
    rm -f /etc/nginx/sites-enabled/default
fi

nginx -t && nginx -s reload
echo "   ✅ HTTP 配置已生效"

# ---------- 3. 申请 Let's Encrypt SSL 证书 ----------
echo "🔒 [4/5] 申请 Let's Encrypt SSL 证书..."
certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "admin@$DOMAIN" \
    --agree-tos \
    --non-interactive \
    --no-eff-email

echo "   ✅ 证书申请成功"

# ---------- 4. 启用完整 HTTPS 配置 ----------
echo "🌐 [5/5] 启用完整 HTTPS 配置..."
cp /tmp/tools-ssl.conf /etc/nginx/conf.d/tools-management.conf
nginx -t && nginx -s reload
echo "   ✅ HTTPS 已启用"

# ---------- 5. 配置自动续期 ----------
echo "⏰ 配置证书自动续期..."
# Let's Encrypt 证书有效期 90 天，certbot 会自动续期
# 添加 cron 任务：每天凌晨 3 点检查续期
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 3 * * * certbot renew --quiet --post-hook 'nginx -s reload'") | crontab -
echo "   ✅ 自动续期已配置（每天 03:00 检查）"

# 清理临时文件
rm -f /tmp/tools-ssl.conf /tmp/tools-http-only.conf

echo ""
echo "✅ ========== 域名配置完成 =========="
echo "   PC 端:   https://$DOMAIN/"
echo "   手机端:  https://$DOMAIN/m/"
echo "   证书有效期: 90 天（自动续期已配置）"
echo "   续期检查: 每天 03:00"
echo "====================================="
echo ""
echo "💡 验证证书状态: certbot certificates"
echo "💡 手动续期测试: certbot renew --dry-run"
