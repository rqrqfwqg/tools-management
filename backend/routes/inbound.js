// 入库单模块（增量 PRD：盘库货位化重写 + 入库单模块）
// 权限：建单 = 物料管理员(requireMaterialManager)；收货/列表 = 任意已登录现场人员(authenticate)。
// 复用 materials.js 的 writeMovement 写 in 流水。
const express = require('express');
const { readDB, writeDB, nextId, nowCST } = require('./db');
const { authenticate, requireMaterialManager } = require('../middleware/auth');
const { writeMovement, resolveMaterialTarget, buildLocationPayload } = require('./materials');

const router = express.Router();

// 生成入库单号：RK + 日期(YYYYMMDD) + 当日序号
function genOrderNo(db) {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `RK${d}`;
  const count = (db.inbound_orders || []).filter(o => o.order_no && o.order_no.startsWith(prefix)).length;
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

// 解析物料：按 item_code 或 item_id 精确匹配；type 指定 spare/consumable
function resolveItem(db, item_type, body) {
  const list = item_type === 'consumable' ? (db.consumables || []) : (db.spare_parts || []);
  const codeKey = item_type === 'consumable' ? 'consumable_code' : 'spare_code';
  const idKey = item_type === 'consumable' ? 'consumable_id' : 'spare_id';
  const nameKey = item_type === 'consumable' ? 'consumable_name' : 'spare_name';
  const code = body.item_code != null ? String(body.item_code).trim() : '';
  const id = body.item_id != null ? Number(body.item_id) : null;
  let item = null;
  if (code) item = list.find(x => x[codeKey] === code);
  if (!item && id) item = list.find(x => x[idKey] === id);
  if (!item) return null;
  return {
    item_id: item[idKey],
    item_code: item[codeKey],
    item_name: item[nameKey],
    warehouse_id: item.warehouse_id != null ? Number(item.warehouse_id) : null
  };
}

// 解析货位：按 location_code（大小写不敏感）或 location_id
function resolveLocation(db, body) {
  const locations = db.storage_locations || [];
  if (body.location_id != null) {
    return locations.find(l => l.location_id === Number(body.location_id)) || null;
  }
  const code = body.location_code != null ? String(body.location_code).trim().toUpperCase() : '';
  if (!code) return null;
  return locations.find(l => (l.location_code || '').toUpperCase() === code) || null;
}

// ============ 入库单：扫码解析货位/物料（供小程序快捷入库 / 现场收货定位） ============
// POST /inbound-orders/resolve-location { code } → 解析货位码或物料编码，返回物料 + 货位 + 系统库存
router.post('/inbound-orders/resolve-location', authenticate, (req, res) => {
  const { code: rawCode } = req.body;
  const code = String(rawCode == null ? '' : rawCode).trim().toUpperCase();
  if (!code) return res.status(400).json({ message: '编码不能为空' });
  const db = readDB();
  const resolved = resolveMaterialTarget(db, code);
  if (!resolved) return res.status(400).json({ message: '无法识别的编码（应为货位码或物料编码）' });
  return res.json({
    item_type: resolved.itemType,
    item_id: resolved.itemType === 'spare' ? resolved.item.spare_id : resolved.item.consumable_id,
    item_code: resolved.itemCode,
    item_name: resolved.itemName,
    system_qty: Number(resolved.item.stock_qty || 0),
    warehouse_id: resolved.item.warehouse_id != null ? Number(resolved.item.warehouse_id) : null,
    location: buildLocationPayload(db, resolved.location)
  });
});

// ============ 入库单：建单（物料管理员） ============
// POST /inbound-orders
// body: { item_type, item_code|item_id, qty, warehouse_id, shelf_id?, location_code|location_id, remark? }
router.post('/inbound-orders', authenticate, requireMaterialManager, (req, res) => {
  const { item_type, qty, warehouse_id, shelf_id, remark } = req.body;
  if (item_type !== 'spare' && item_type !== 'consumable') {
    return res.status(400).json({ message: '物料类型必须为 spare 或 consumable' });
  }
  const nQty = Math.floor(Number(qty));
  if (!Number.isFinite(nQty) || nQty <= 0) {
    return res.status(400).json({ message: '数量必须为正整数' });
  }
  if (warehouse_id == null) {
    return res.status(400).json({ message: '请选择目标仓库' });
  }
  const db = readDB();
  const warehouse = (db.warehouses || []).find(w => w.warehouse_id === Number(warehouse_id));
  if (!warehouse) return res.status(404).json({ message: '仓库不存在' });

  // 解析物料
  const item = resolveItem(db, item_type, req.body);
  if (!item) return res.status(404).json({ message: '物料不存在（请检查物料编码或 ID）' });

  // 解析货位并校验归属
  const location = resolveLocation(db, req.body);
  if (!location) return res.status(400).json({ message: '货位不存在（请检查货位码或货位 ID）' });
  if (Number(location.warehouse_id) !== Number(warehouse_id)) {
    return res.status(400).json({ message: '货位不属于所选仓库，请核对货位' });
  }
  if (shelf_id != null && Number(location.shelf_id) !== Number(shelf_id)) {
    return res.status(400).json({ message: '货位与所选货架不一致，请核对' });
  }

  const user = db.users.find(u => u.user_id === req.user.user_id);
  const newOrder = {
    order_id: nextId(db.inbound_orders || [], 'order_id'),
    order_no: genOrderNo(db),
    item_type,
    item_id: item.item_id,
    item_code: item.item_code,
    item_name: item.item_name,
    qty: nQty,
    warehouse_id: Number(warehouse_id),
    shelf_id: location.shelf_id,
    location_id: location.location_id,
    location_code: location.location_code,
    status: 'pending',
    creator_id: user ? user.user_id : null,
    creator_name: user ? (user.real_name || user.username) : '',
    created_at: nowCST(),
    receiver_id: null,
    receiver_name: null,
    received_at: null,
    remark: remark || ''
  };
  if (!db.inbound_orders) db.inbound_orders = [];
  db.inbound_orders.push(newOrder);
  writeDB(db);
  res.json(newOrder);
});

// ============ 入库单：列表（任意已登录） ============
// GET /inbound-orders?status=pending|received&item_type=spare|consumable
router.get('/inbound-orders', authenticate, (req, res) => {
  const db = readDB();
  let list = (db.inbound_orders || []).slice();
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  if (req.query.item_type) list = list.filter(o => o.item_type === req.query.item_type);
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(list);
});

// ============ 入库单：扫码收货（任意已登录现场人员） ============
// POST /inbound-orders/:id/receive { location_code?, actual_qty? }
router.post('/inbound-orders/:id/receive', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const { location_code, actual_qty } = req.body;
  const db = readDB();
  const idx = (db.inbound_orders || []).findIndex(o => o.order_id === id);
  if (idx === -1) return res.status(404).json({ message: '入库单不存在' });
  const order = db.inbound_orders[idx];
  if (order.status !== 'pending') return res.status(400).json({ message: '该入库单已收货，无法重复收货' });

  // 货位一致性校验（防误收）：若传 location_code，必须与该单据货位一致
  if (location_code != null && String(location_code).trim() !== '') {
    const code = String(location_code).trim().toUpperCase();
    if (code !== String(order.location_code || '').toUpperCase()) {
      return res.status(400).json({ message: `货位不一致：当前扫到「${location_code}」，单据货位为「${order.location_code}」` });
    }
  }

  // 实收数量：默认取单据 qty，可传 actual_qty 覆盖（支持实收≠计划，R12）
  const nQty = actual_qty != null && String(actual_qty).trim() !== ''
    ? Math.floor(Number(actual_qty))
    : order.qty;
  if (!Number.isFinite(nQty) || nQty <= 0) {
    return res.status(400).json({ message: '实收数量必须为正整数' });
  }

  const itemType = order.item_type;
  const key = itemType === 'consumable' ? 'consumable_id' : 'spare_id';
  const list = itemType === 'consumable' ? (db.consumables || []) : (db.spare_parts || []);
  const mIdx = list.findIndex(x => x[key] === order.item_id);
  if (mIdx === -1) return res.status(404).json({ message: '入库单对应物料不存在' });

  // 写 in 流水（署名收货人），同步库存 +
  const user = db.users.find(u => u.user_id === req.user.user_id);
  writeMovement(db, {
    item_type: itemType,
    item_id: order.item_id,
    item_code: order.item_code,
    item_name: order.item_name,
    movement_type: 'in',
    qty: nQty,
    operator_id: user ? user.user_id : null,
    operator_name: user ? (user.real_name || user.username) : '',
    order_id: order.order_id,
    remark: `入库 ${order.order_no}`
  });
  list[mIdx].stock_qty = (Number(list[mIdx].stock_qty) || 0) + nQty;

  // 标记已收货
  order.status = 'received';
  order.receiver_id = user ? user.user_id : null;
  order.receiver_name = user ? (user.real_name || user.username) : '';
  order.received_at = nowCST();
  order.received_qty = nQty;
  writeDB(db);
  res.json(order);
});

module.exports = router;
