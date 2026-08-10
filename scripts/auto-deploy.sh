#!/bin/bash
# 自动检测 GitHub 推送并执行部署
# 由 cron 定时调用，仅在检测到新 commit 时执行构建/部署

set -e

cd /opt/tools-management

# 解决 stdout 问题 - 有时 cron 下输出会卡住
exec 1>>/opt/tools-management/logs/auto-deploy.log 2>&1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

DEPLOY_STATUS_FILE="/opt/tools-management/logs/deploy-status.json"

write_status() {
  local status="$1"
  local message="$2"
  cat > "$DEPLOY_STATUS_FILE" <<EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "status": "$status",
  "message": "$message",
  "deployed": $(if [ "$status" = "done" ] || [ "$status" = "error" ]; then echo true; else echo false; fi)
}
EOF
}

# 1. 检查远程是否有新提交
git remote update 2>&1

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  # 已是最新，清除状态文件表示一切正常
  if [ -f "$DEPLOY_STATUS_FILE" ]; then
    STATUS=$(grep -o '"status": *"[^"]*"' "$DEPLOY_STATUS_FILE" | cut -d'"' -f4)
    if [ "$STATUS" = "deploying" ] || [ "$STATUS" = "error" ]; then
      write_status "ok" "已是最新，部署完成"
    fi
  fi
  exit 0
fi

if [ "$LOCAL" != "$BASE" ]; then
  log "⚠️ 本地有未推送的 commit，跳过自动部署"
  write_status "skipped" "本地有未推送的 commit，跳过自动部署"
  exit 1
fi

log "📥 检测到新提交，开始部署..."
write_status "deploying" "检测到新提交，正在部署..."

# 2. 拉取代码
log "📦 git pull..."
if ! git pull origin main 2>&1; then
  log "❌ git pull 失败"
  write_status "error" "git pull 失败"
  exit 1
fi

# 3. 构建 PC 前端
log "🏗️ 构建 PC 前端..."
cd /opt/tools-management/vue-frontend
if ! npm install --include=dev 2>&1; then
  log "❌ PC 前端 npm install 失败"
  write_status "error" "PC 前端 npm install 失败"
  exit 1
fi
if ! npm run build 2>&1; then
  log "❌ PC 前端构建失败"
  write_status "error" "PC 前端构建失败"
  exit 1
fi
log "✅ PC 前端构建完成"

# 4. 构建移动端前端
log "🏗️ 构建移动端前端..."
cd /opt/tools-management/mobile-frontend
if ! npm install --include=dev 2>&1; then
  log "❌ 移动端 npm install 失败"
  write_status "error" "移动端 npm install 失败"
  exit 1
fi
if ! npm run build:prod 2>&1; then
  log "❌ 移动端构建失败"
  write_status "error" "移动端构建失败"
  exit 1
fi
log "✅ 移动端前端构建完成"

# 5. 导入工具数据（如果脚本存在）
IMPORT_RESULT=""
if [ -f "/opt/tools-management/deploy/production/import-tools.js" ]; then
  log "📊 导入工具数据..."
  cd /opt/tools-management
  IMPORT_OUTPUT=$(NODE_PATH=backend/node_modules node deploy/production/import-tools.js 2>&1)
  log "$IMPORT_OUTPUT"
  IMPORT_RESULT=$(echo "$IMPORT_OUTPUT" | tail -5)
  log "✅ 工具数据导入完成"
else
  IMPORT_RESULT="跳过（deploy/production/import-tools.js 不存在）"
  log "⏭️ 跳过工具导入"
fi

# 6. 重启后端
log "🔄 重启后端服务..."
if ! pm2 restart tools-backend 2>&1; then
  log "❌ PM2 重启失败"
  write_status "error" "PM2 重启后端失败"
  exit 1
fi
pm2 save 2>&1
log "✅ 后端重启完成"

# 7. 健康检查
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3300/api/auth/login 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
  log "✅ 健康检查通过 (HTTP $HTTP_CODE)"
  HEALTH_STATUS="健康检查通过 (HTTP $HTTP_CODE)"
else
  log "❌ 健康检查失败 (HTTP $HTTP_CODE)"
  HEALTH_STATUS="健康检查失败 (HTTP $HTTP_CODE)"
fi

# 获取 git log
GIT_LOG=$(git log --oneline -3)

log "🎉 部署完成！"
write_status "done" "部署成功 | 最近提交: $GIT_LOG | 健康检查: $HEALTH_STATUS | 工具导入: $IMPORT_RESULT"
