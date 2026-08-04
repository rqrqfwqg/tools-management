// 订单管理路由
// v4.0.0：工具/物料领用单拆分（T02）
//  - GET /orders 支持 ?type=tool|material 过滤（含历史推导）
//  - POST /orders 拆单校验：spare_items:[{spare_id,qty}]（兼容旧 spare_ids=1），工具仅 tool_ids，混提 400
//  - approve 物料单走 applyMaterialApprove（强校验库存→扣减→写流水）
//  - return 物料单支持 returns:[{item_id|spare_id, return_qty}] 按量归还
//  - 新增 POST /orders/:id/close 物料单关闭（终态）
//  - cancel 修复：备件 status 一并恢复 available（既有 bug）
//  - DELETE 允许 closed 状态
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId, nowCST } = require('./db');
const { authenticate, requireAdmin, requireApprover } = require('../middleware/auth');
const {
  deriveOrderType,
  normalizeOrderItems,
  applyMaterialApprove,
  applyMaterialReturn,
  applyMaterialClose
} = require('./orders-helpers');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: '参数校验失败', errors: errors.array() });
  }
  next();
};

// 获取订单列表（支持 ?type=tool|material 过滤，含历史推导）
router.get('/orders', authenticate, (req, res) => {
  const db = readDB();
  const orders = db.orders || [];
  const typeFilter = req.query.type;
  let list = orders;
  if (typeFilter === 'tool' || typeFilter === 'material') {
    list = orders.filter(o => deriveOrderType(o) === typeFilter);
  }
  // 为每个 item 补充 image_url（工具与备件分别取图），并归一化数量字段
  const enriched = list.map(o => ({
    ...o,
    order_type: deriveOrderType(o),
    items: normalizeOrderItems(o.items).map(item => {
      let imageUrl = '';
      if (item.item_type === 'spare') {
        imageUrl = (db.spare_parts || []).find(s => s.spare_id === item.spare_id)?.image_url || '';
      } else {
        imageUrl = (db.tools || []).find(t => t.tool_id === item.tool_id)?.image_url || '';
      }
      return { ...item, image_url: imageUrl };
    })
  }));
  if (req.user.role !== 'admin' && req.user.role !== 'team_leader') {
    const user = db.users.find(u => u.user_id === req.user.user_id);
    return res.json(enriched.filter(o => o.borrower_name === (user?.real_name || user?.username)));
  }
  res.json(enriched);
});

// 创建订单（工具单 / 物料单拆单）
router.post('/orders', authenticate, [
  body('tool_ids').optional().isArray(),
  body('spare_ids').optional().isArray(),
  body('spare_items').optional().isArray(),
  body('toolkit').optional().isString(),
  validate
], (req, res) => {
  const { tool_ids, spare_ids, spare_items, toolkit, warehouse, scene, expected_return, purpose } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  // ---- 拆单校验：工具与备件不能混提 ----
  const hasTools = !!((tool_ids && tool_ids.length > 0) || toolkit);
  const hasSpareItems = !!(spare_items && spare_items.length > 0);
  const hasLegacySpareIds = !!(spare_ids && spare_ids.length > 0);
  if (hasTools && (hasSpareItems || hasLegacySpareIds)) {
    return res.status(400).json({ message: '工具与备件不能在同一订单中领用，请分别下单' });
  }

  // 支持工具包批量领用：自动收集该包下所有可用工具
  let resolvedIds = tool_ids || [];
  if (toolkit) {
    const kitId = parseInt(toolkit);
    let kitTools;
    if (!isNaN(kitId) && (db.toolkits || []).find(k => k.toolkit_id === kitId)) {
      // 新方式：通过 toolkit_id + toolkit_items 查找
      const itemToolIds = (db.toolkit_items || []).filter(i => i.toolkit_id === kitId).map(i => i.tool_id);
      kitTools = db.tools.filter(t => itemToolIds.includes(t.tool_id) && t.status === 'available');
    } else {
      // 兼容旧方式：通过 toolkit_name 查找
      kitTools = db.tools.filter(t => t.toolkit_name === toolkit && t.status === 'available');
    }
    if (kitTools.length === 0) return res.status(400).json({ message: `工具包"${toolkit}"中没有可用工具` });
    const kitIds = kitTools.map(t => t.tool_id);
    resolvedIds = [...new Set([...resolvedIds, ...kitIds])];
  }

  // ---- 物料条目归一：spare_items:[{spare_id,qty}]，兼容旧 spare_ids（默认 qty=1） ----
  const resolvedSpareItems = []; // [{ spare, qty }]
  if (hasSpareItems) {
    for (const si of spare_items) {
      const spareId = Number(si.spare_id);
      const qty = si.qty != null ? Number(si.qty) : 1;
      if (!Number.isInteger(spareId) || spareId <= 0) return res.status(400).json({ message: '备件参数不合法' });
      if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: '备件领用数量必须为正整数' });
      const sp = (db.spare_parts || []).find(s => s.spare_id === spareId);
      if (!sp) return res.status(400).json({ message: `备件ID ${spareId} 不存在` });
      if (Number(sp.stock_qty) < qty) {
        return res.status(400).json({ message: `备件「${sp.spare_name}」库存不足（需 ${qty}，现有 ${sp.stock_qty}）` });
      }
      resolvedSpareItems.push({ spare: sp, qty });
    }
  } else if (hasLegacySpareIds) {
    for (const spareId of spare_ids) {
      const sp = (db.spare_parts || []).find(s => s.spare_id === Number(spareId));
      if (!sp) return res.status(400).json({ message: `备件ID ${spareId} 不存在` });
      if (sp.status !== 'available') return res.status(400).json({ message: `备件${sp.spare_name} 当前状态为${sp.status}，不可领用` });
      resolvedSpareItems.push({ spare: sp, qty: 1 });
    }
  }

  if (resolvedIds.length === 0 && resolvedSpareItems.length === 0) {
    return res.status(400).json({ message: '请选择至少要领用的工具或备件' });
  }

  // 检查工具可用性
  const unavailableTools = [];
  for (const toolId of resolvedIds) {
    const tool = db.tools.find(t => t.tool_id === toolId);
    if (!tool) unavailableTools.push(`工具ID ${toolId} 不存在`);
    else if (tool.status !== 'available') unavailableTools.push(`${tool.tool_name} 当前状态为${tool.status}，不可领用`);
  }
  if (unavailableTools.length > 0) {
    return res.status(400).json({ message: unavailableTools.join('；') });
  }

  // 部门权限校验：非 admin 用户只能借本部门 + 共享仓库的工具
  if (req.user.role !== 'admin') {
    const warehouses = db.warehouses || [];
    const deptMismatchTools = [];
    for (const toolId of resolvedIds) {
      const tool = db.tools.find(t => t.tool_id === toolId);
      if (!tool) continue;
      const warehouse = warehouses.find(w => w.warehouse_id === tool.warehouse_id);
      if (warehouse && warehouse.dept_id !== null && warehouse.dept_id !== undefined && warehouse.dept_id !== user.dept_id) {
        deptMismatchTools.push(`${tool.tool_name}（${warehouse.warehouse_name}）`);
      }
    }
    if (deptMismatchTools.length > 0) {
      return res.status(403).json({ message: `无权领用其他部门仓库的工具：${deptMismatchTools.join('、')}` });
    }
  }

  const orderNo = `ORD${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  let itemCounter = Date.now();
  const items = [];
  for (const toolId of resolvedIds) {
    const tool = db.tools.find(t => t.tool_id === toolId);
    const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
    items.push({
      item_id: (itemCounter++ << 12) | (randomPart & 0xFFF),
      tool_id: toolId, tool_code: tool.tool_code, tool_name: tool.tool_name,
      item_status: 'reserved'
    });
  }
  for (const { spare: sp, qty } of resolvedSpareItems) {
    const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
    items.push({
      item_id: (itemCounter++ << 12) | (randomPart & 0xFFF),
      item_type: 'spare',
      spare_id: sp.spare_id, spare_code: sp.spare_code, spare_name: sp.spare_name,
      item_status: 'reserved',
      borrow_qty: qty, returned_qty: 0, return_records: []
    });
  }

  const newOrder = {
    order_id: nextId(db.orders, 'order_id'),
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_phone: user.phone || '',
    borrower_id: user.user_id,
    status: 'pending',
    order_type: resolvedSpareItems.length > 0 ? 'material' : 'tool',
    warehouse: warehouse || '', scene: scene || '',
    borrow_time: nowCST(),
    expected_return: expected_return || null,
    actual_return: null, purpose: purpose || '',
    require_approval: true,
    created_at: nowCST(),
    items: items
  };

  for (const toolId of resolvedIds) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
    if (toolIndex > -1) db.tools[toolIndex].status = 'reserved';
  }
  // 备件：数量库存模型下不在创建时置 reserved（无在途占用计数），approve 时强校验扣减

  db.orders.push(newOrder);
  writeDB(db);
  res.json(newOrder);
});

// 超时待审工单提醒（超过30分钟未审核）
router.get('/orders/pending-alerts', authenticate, (req, res) => {
  const db = readDB();
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const overdueOrders = (db.orders || []).filter(o => {
    if (o.status !== 'pending') return false;
    const created = new Date(o.created_at);
    return created <= thirtyMinAgo;
  }).map(o => ({
    order_id: o.order_id,
    order_no: o.order_no,
    borrower_name: o.borrower_name,
    created_at: o.created_at,
    minutes_waiting: Math.floor((now - new Date(o.created_at)) / (60 * 1000)),
    items_count: (o.items || []).length,
    scene: o.scene || '',
    warehouse: o.warehouse || ''
  }));

  res.json({
    total: overdueOrders.length,
    orders: overdueOrders
  });
});

// 批准订单（物料单走 applyMaterialApprove；工具单保持原逻辑）
router.post('/orders/:id/approve', authenticate, requireApprover, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });
  if (db.orders[orderIndex].status !== 'pending') return res.status(400).json({ message: '只能批准待审核的订单' });

  const order = db.orders[orderIndex];
  if (deriveOrderType(order) === 'material') {
    const result = applyMaterialApprove(db, order, req.user);
    if (!result.ok) return res.status(400).json({ message: result.error });
    writeDB(db);
    return res.json({ message: '已批准', order });
  }

  db.orders[orderIndex].status = 'borrowed';
  for (const item of db.orders[orderIndex].items) {
    if (item.item_type === 'spare') {
      const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
      if (idx > -1) {
        db.spare_parts[idx].status = 'borrowed';
        db.spare_parts[idx].borrow_count = (db.spare_parts[idx].borrow_count || 0) + 1;
      }
    } else {
      const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (toolIndex > -1) {
        db.tools[toolIndex].status = 'borrowed';
        db.tools[toolIndex].borrow_count = (db.tools[toolIndex].borrow_count || 0) + 1;
      }
    }
    item.item_status = 'borrowed';
  }
  writeDB(db);
  res.json({ message: '已批准' });
});

// 拒绝订单
router.post('/orders/:id/reject', authenticate, requireApprover, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });
  if (db.orders[orderIndex].status !== 'pending') return res.status(400).json({ message: '只能拒绝待审核的订单' });

  for (const item of db.orders[orderIndex].items) {
    if (item.item_type === 'spare') {
      const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
      if (idx > -1) db.spare_parts[idx].status = 'available';
    } else {
      const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (toolIndex > -1) db.tools[toolIndex].status = 'available';
    }
  }
  db.orders[orderIndex].status = 'rejected';
  writeDB(db);
  res.json({ message: '已拒绝' });
});

// 归还订单（物料单支持按量归还 returns:[{item_id|spare_id, return_qty}]，缺省=全还；工具单保持整单归还）
router.post('/orders/:id/return', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const { returns } = req.body || {};
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (order.status !== 'borrowed' && order.status !== 'approved') return res.status(400).json({ message: '只能归还借出中或已批准的订单' });
  if (order.borrower_id !== req.user.user_id && req.user.role !== 'admin' && req.user.role !== 'team_leader' && req.user.role !== 'material_manager') {
    return res.status(403).json({ message: '只有领用人、分队长、管理员或物料管理员才能归还' });
  }

  // 物料单：按量归还
  if (deriveOrderType(order) === 'material') {
    const result = applyMaterialReturn(db, order, req.user, returns);
    if (!result.ok) return res.status(400).json({ message: result.error });
    writeDB(db);
    return res.json({
      message: result.allReturned ? '已全部归还' : '已归还（部分归还，仍处于借出中）',
      order
    });
  }

  // 借出中的工单必须完成现场清点才能归还（工具单）
  if (order.status === 'borrowed') {
    const unchecked = order.items.filter(i => !i.checked);
    if (unchecked.length > 0) {
      return res.status(400).json({ message: `请先完成现场清点（${order.items.length - unchecked.length}/${order.items.length}）` });
    }
  }

  for (const item of order.items) {
    if (item.item_type === 'spare') {
      const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
      if (idx > -1) db.spare_parts[idx].status = 'available';
    } else {
      const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (toolIndex > -1) db.tools[toolIndex].status = 'available';
    }
    item.item_status = 'returned';
  }
  db.orders[orderIndex].status = 'returned';
  db.orders[orderIndex].actual_return = nowCST();
  writeDB(db);
  res.json({ message: '已归还' });
});

// 关闭物料单（终态）：仅物料单、借出中/部分归还后可关；历史单 400
router.post('/orders/:id/close', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (deriveOrderType(order) !== 'material') return res.status(400).json({ message: '仅物料领用单支持关闭' });
  if (order.status !== 'borrowed' && order.status !== 'approved') {
    return res.status(400).json({ message: '仅借出中或部分归还的物料单可关闭' });
  }
  if (order.borrower_id !== req.user.user_id && req.user.role !== 'admin' && req.user.role !== 'team_leader' && req.user.role !== 'material_manager') {
    return res.status(403).json({ message: '只有领用人、分队长、管理员或物料管理员才能关闭' });
  }

  const result = applyMaterialClose(db, order, req.user);
  if (!result.ok) return res.status(400).json({ message: result.error });
  writeDB(db);
  res.json({ message: '已关闭', order: result.order, summary: result.summary });
});

// 获取清点进度
router.get('/orders/:id/checklist', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const order = db.orders.find(o => o.order_id === orderId);
  if (!order) return res.status(404).json({ message: '订单不存在' });

  const items = (order.items || []).map(item => ({
    tool_id: item.tool_id ?? item.spare_id,
    item_type: item.item_type || 'tool',
    item_code: item.tool_code || item.spare_code,
    tool_code: item.tool_code || item.spare_code,
    tool_name: item.tool_name || item.spare_name,
    checked: !!item.checked,
    checked_at: item.checked_at || null,
    checked_by: item.checked_by || null
  }));
  res.json({ items });
});

// 保存单项清点状态
router.post('/orders/:id/checklist', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const { tool_id, checked } = req.body;
  if (!tool_id) return res.status(400).json({ message: '缺少 tool_id' });

  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (order.status !== 'borrowed') return res.status(400).json({ message: '只有借出中的订单才能清点' });

  const item = order.items.find(i => (i.tool_id ?? i.spare_id) === tool_id);
  if (!item) return res.status(404).json({ message: '物料不在该工单中' });

  item.checked = !!checked;
  item.checked_at = checked ? nowCST() : null;
  item.checked_by = checked ? (req.user.real_name || req.user.username) : null;

  writeDB(db);
  res.json({
    message: '已更新',
    item: { tool_id, checked: item.checked, checked_at: item.checked_at, checked_by: item.checked_by }
  });
});

// 取消订单（修复：备件 status 一并恢复 available）
router.post('/orders/:id/cancel', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (order.status !== 'pending') return res.status(400).json({ message: '只能取消待审核的订单' });
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能取消自己的订单' });

  for (const item of order.items) {
    if (item.item_type === 'spare') {
      const spIndex = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
      if (spIndex > -1) db.spare_parts[spIndex].status = 'available';
    } else {
      const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (toolIndex > -1) db.tools[toolIndex].status = 'available';
    }
  }
  db.orders[orderIndex].status = 'cancelled';
  writeDB(db);
  res.json({ message: '已取消' });
});

// 通用状态更新（手机端使用）
router.put('/orders/:id/status', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: '无效的状态值' });
  }
  const db = readDB();
  const idx = db.orders.findIndex(o => o.order_id === orderId);
  if (idx === -1) return res.status(404).json({ message: '订单不存在' });
  const order = db.orders[idx];

  if (status === 'approved') {
    if (order.status !== 'pending') return res.status(400).json({ message: '只能批准待审核的订单' });
    if (req.user.role !== 'admin' && req.user.role !== 'team_leader') return res.status(403).json({ message: '无审批权限' });
    if (deriveOrderType(order) === 'material') {
      const result = applyMaterialApprove(db, order, req.user);
      if (!result.ok) return res.status(400).json({ message: result.error });
    } else {
      db.orders[idx].status = 'borrowed';
      for (const item of db.orders[idx].items) {
        if (item.item_type === 'spare') {
          const ti = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
          if (ti > -1) { db.spare_parts[ti].status = 'borrowed'; db.spare_parts[ti].borrow_count = (db.spare_parts[ti].borrow_count || 0) + 1; }
        } else {
          const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
          if (ti > -1) { db.tools[ti].status = 'borrowed'; db.tools[ti].borrow_count = (db.tools[ti].borrow_count || 0) + 1; }
        }
        item.item_status = 'borrowed';
      }
    }
  } else if (status === 'rejected') {
    if (order.status !== 'pending') return res.status(400).json({ message: '只能拒绝待审核的订单' });
    if (req.user.role !== 'admin' && req.user.role !== 'team_leader') return res.status(403).json({ message: '无审批权限' });
    for (const item of order.items) {
      if (item.item_type === 'spare') {
        const ti = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
        if (ti > -1) db.spare_parts[ti].status = 'available';
      } else {
        const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
        if (ti > -1) db.tools[ti].status = 'available';
      }
    }
    db.orders[idx].status = 'rejected';
  } else if (status === 'cancelled') {
    if (order.status !== 'pending') return res.status(400).json({ message: '只能取消待审核的订单' });
    if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能取消自己的订单' });
    for (const item of order.items) {
      if (item.item_type === 'spare') {
        const ti = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
        if (ti > -1) db.spare_parts[ti].status = 'available';
      } else {
        const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
        if (ti > -1) db.tools[ti].status = 'available';
      }
    }
    db.orders[idx].status = 'cancelled';
  }
  writeDB(db);
  res.json({ message: `已${status === 'approved' ? '批准' : status === 'rejected' ? '拒绝' : '取消'}` });
});

// 删除订单
router.delete('/orders/:id', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (!['returned', 'cancelled', 'rejected', 'closed'].includes(order.status)) return res.status(400).json({ message: '只能删除已归还、已取消、已拒绝或已关闭的订单' });
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能删除自己的订单' });

  db.orders.splice(orderIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

module.exports = router;
