#!/bin/bash
# 系统 crontab 定时检查超时未审工单，直接发微信消息（无需模型介入）
# 每15分钟执行一次

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT=$("$SCRIPT_DIR/check-pending-orders.sh" 2>/dev/null)

if [ "$OUTPUT" != "NO_REPLY" ]; then
  export PATH="/home/ubuntu/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin"
  echo "发送工单提醒: $(echo "$OUTPUT" | head -1)" >> /tmp/cron-check-orders.log
  openclaw message send \
    --channel openclaw-weixin \
    --target "o9cq801qPOeQ0upRP5yZOI4ptPTM@im.wechat" \
    --account "5e23c4b7fcba-im-bot" \
    --message "$OUTPUT" 2>&1 >> /tmp/cron-check-orders.log
fi
