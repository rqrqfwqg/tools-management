#!/bin/bash
# 检查超时未审核工单（超过30分钟）
# 直接读取 db.json，不需要认证

DB_PATH="/opt/tools-management/backend/db.json"

if [ ! -f "$DB_PATH" ]; then
  echo '{"total":0,"orders":[],"error":"数据库文件不存在"}'
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
}).map(o => ({
  order_id: o.order_id,
  order_no: o.order_no,
  borrower_name: o.borrower_name,
  borrower_id: o.borrower_id,
  created_at: o.created_at,
  minutes_waiting: Math.floor((now - new Date(o.created_at)) / (60 * 1000)),
  items_count: (o.items || []).length,
  items: (o.items || []).map(i => i.tool_name),
  scene: o.scene || "",
  warehouse: o.warehouse || ""
}));

console.log(JSON.stringify({
  total: overdue.length,
  checked_at: now.toISOString(),
  orders: overdue
}));
'
