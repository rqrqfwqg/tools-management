#!/bin/bash
# 自动检测 GitHub 推送并执行部署
# 由 cron 定时调用，仅在检测到新 commit 时执行构建/部署
#
# 部署策略（2026-08-20 调整）：
#   - 后端重启是最高优先级：git pull 成功后立即重启 tools-backend-miniapp，
#     确保后端代码第一时间生效。
#   - 前端构建失败只记录状态、不阻断。旧版全局 set -e 会在前端构建失败时
#     exit 1 跳过 pm2 restart，导致「代码已拉到磁盘、线上进程还是旧代码」——
#     本次线上 SP-T2-001 扫码 400 事故的根因。
#   - 关键步骤（git remote update / git pull / pm2 restart）失败仍会退出。

cd /opt/tools-management

# 解决 stdout 问题 - 有时 cron 下输出会卡住
exec 1>>/opt/tools-management/logs/auto-deploy.log 2>&1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# pm2 绝对路径：cron 环境的 PATH 精简（通常仅 /usr/bin:/bin），裸 pm2 会找不到，
# 必须显式指定。若服务器 pm2 不在下列常见路径，请 export PM2_BIN=/path/to/pm2 或直接改这里。
PM2_BIN="${PM2_BIN:-}"
if [ -z "$PM2_BIN" ]; then
  for p in /usr/local/bin/pm2 /usr/bin/pm2 "$HOME/.local/bin/pm2" "$HOME/npm-global/bin/pm2" "$(dirname "$(command -v npm 2>/dev/null || echo /usr/local/bin/npm)")/pm2"; do
    if [ -x "$p" ]; then PM2_BIN="$p"; break; fi
  done
  PM2_BIN="${PM2_BIN:-/usr/local/bin/pm2}"
fi
log "使用 pm2: $PM2_BIN"

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

# ---------- 步骤 1：检查远程是否有新提交（关键步骤，失败即退出） ----------
if ! git remote update 2>&1; then
  log "❌ git remote update 失败（网络问题），跳过本轮部署"
  write_status "error" "git remote update 失败，跳过本轮部署"
  exit 1
fi

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

# ---------- 步骤 2：拉取代码（关键步骤，失败即退出） ----------
log "📦 git pull..."
if ! git pull origin main 2>&1; then
  log "❌ git pull 失败"
  write_status "error" "git pull 失败"
  exit 1
fi

# ---------- 步骤 3：重启后端（最高优先级，独立于前端构建） ----------
# 放在前端构建之前：即使后面 PC/移动端构建失败，后端代码也已更新，
# 避免再次出现「代码已拉到磁盘但线上进程还是旧代码」的事故。
log "🔄 重启后端服务（独立步骤，不受前端构建结果影响）..."
if ! "$PM2_BIN" restart tools-backend-miniapp 2>&1; then
  log "❌ PM2 重启失败"
  write_status "error" "PM2 重启后端失败"
  exit 1
fi
"$PM2_BIN" save 2>&1 || true
log "✅ 后端重启完成"

# ---------- 步骤 4：构建 PC 前端（失败不阻断，仅记录） ----------
PC_RESULT="成功"
log "🏗️ 构建 PC 前端..."
cd /opt/tools-management/vue-frontend
if ! npm install --include=dev 2>&1; then
  log "❌ PC 前端 npm install 失败（后端已更新，前端下次部署再补）"
  PC_RESULT="失败(npm install)"
else
  if ! npm run build 2>&1; then
    log "❌ PC 前端构建失败（后端已更新，前端下次部署再补）"
    PC_RESULT="失败(build)"
  else
    log "✅ PC 前端构建完成"
  fi
fi

# ---------- 步骤 5：构建移动端前端（失败不阻断，仅记录） ----------
MOBILE_RESULT="成功"
log "🏗️ 构建移动端前端..."
cd /opt/tools-management/mobile-frontend
if ! npm install --include=dev 2>&1; then
  log "❌ 移动端 npm install 失败（后端已更新，前端下次部署再补）"
  MOBILE_RESULT="失败(npm install)"
else
  if ! npm run build:prod 2>&1; then
    log "❌ 移动端构建失败（后端已更新，前端下次部署再补）"
    MOBILE_RESULT="失败(build)"
  else
    log "✅ 移动端前端构建完成"
  fi
fi

# ---------- 步骤 6：导入工具数据（失败不阻断） ----------
IMPORT_RESULT=""
if [ -f "/opt/tools-management/deploy/production/import-tools.js" ]; then
  log "📊 导入工具数据..."
  cd /opt/tools-management
  IMPORT_OUTPUT=$(NODE_PATH=backend/node_modules node deploy/production/import-tools.js 2>&1) || true
  log "$IMPORT_OUTPUT"
  IMPORT_RESULT=$(echo "$IMPORT_OUTPUT" | tail -5)
  log "✅ 工具数据导入完成"
else
  IMPORT_RESULT="跳过（deploy/production/import-tools.js 不存在）"
  log "⏭️ 跳过工具导入"
fi

# ---------- 步骤 7：健康检查 ----------
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3300/api/auth/login 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
  log "✅ 健康检查通过 (HTTP $HTTP_CODE)"
  HEALTH_STATUS="健康检查通过 (HTTP $HTTP_CODE)"
else
  log "❌ 健康检查失败 (HTTP $HTTP_CODE)"
  HEALTH_STATUS="健康检查失败 (HTTP $HTTP_CODE)"
fi

# ---------- 步骤 8：汇总状态 ----------
GIT_LOG=$(git log --oneline -3)

if [ "$PC_RESULT" = "成功" ] && [ "$MOBILE_RESULT" = "成功" ]; then
  log "🎉 部署完成（后端+前端全部更新）"
  write_status "done" "部署成功 | 最近提交: $GIT_LOG | 健康检查: $HEALTH_STATUS | 工具导入: $IMPORT_RESULT"
else
  log "⚠️ 后端已更新，但前端构建未全部成功（PC: $PC_RESULT, 移动: $MOBILE_RESULT）"
  write_status "error" "后端已更新；前端构建: PC=$PC_RESULT, 移动=$MOBILE_RESULT | 最近提交: $GIT_LOG | 健康检查: $HEALTH_STATUS"
fi
