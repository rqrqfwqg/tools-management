#!/bin/bash
# 检查超时未审核工单，直接输出格式化提醒消息
DB_PATH="/opt/tools-management/backend/db.json"

if [ ! -f "$DB_PATH" ]; then
  echo "NO_REPLY"
  exit 0
fi

node -e '
const fs = require("fs");
const db = JSON.parse(fs.readFileSync("'"$DB_PATH"'", "utf8"));
const now = new Date();
const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

const overdue = (db.orders || []).filter(o => {
  if (o.status !== "pending") return false;
  const created = new Date(o.created_at);
  return created <= thirtyMinAgo;
});

if (overdue.length === 0) {
  console.log("NO_REPLY");
  process.exit(0);
}

const formatCST = (iso) => new Date(iso).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai", hour12:false});

let msg = "⚠️ 有工单等待审核！\n\n";
overdue.forEach((o, i) => {
  const items = (o.items || []).map(i => i.tool_name).join("、");
  const mins = Math.floor((now - new Date(o.created_at)) / 60000);
  msg += `工单 #${o.order_no || o.order_id}\n`
       + `申请人：${o.borrower_name}\n`
       + `时间：${formatCST(o.created_at)}（已等${mins}分钟）\n`
       + `物品：${items}\n`;
  if (o.scene) msg += `场景：${o.scene}\n`;
  if (i < overdue.length - 1) msg += "——\n";
});

console.log(msg);
'
