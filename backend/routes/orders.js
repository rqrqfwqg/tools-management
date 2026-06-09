// 订单管理路由
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, requireAdmin, requireApprover } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: '参数校验失败', errors: errors.array() });
  }
  next();
};

// 获取订单列表
router.get('/orders', authenticate, (req, res) => {
  const db = readDB();
  const orders = db.orders || [];
  // 为每个 item 补充 image_url
  const enriched = orders.map(o => ({
    ...o,
    items: (o.items || []).map(item => {
      const tool = db.tools.find(t => t.tool_id === item.tool_id);
      return { ...item, image_url: tool?.image_url || '' };
    })
  }));
  if (req.user.role !== 'admin' && req.user.role !== 'team_leader') {
    const user = db.users.find(u => u.user_id === req.user.user_id);
    return res.json(enriched.filter(o => o.borrower_name === (user?.real_name || user?.username)));
  }
  res.json(enriched);
});

// 创建订单
router.post('/orders', authenticate, [
  body('tool_ids').optional().isArray(),
  body('toolkit').optional().isString(),
  validate
], (req, res) => {
  const { tool_ids, toolkit, warehouse, scene, expected_return, purpose } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

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

  if (resolvedIds.length === 0) return res.status(400).json({ message: '请选择至少要领用的工具' });

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

  const orderNo = `ORD${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  let itemCounter = Date.now();
  const items = resolvedIds.map(toolId => {
    const tool = db.tools.find(t => t.tool_id === toolId);
    const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
    return {
      item_id: (itemCounter++ << 12) | (randomPart & 0xFFF),
      tool_id: toolId, tool_code: tool.tool_code, tool_name: tool.tool_name,
      item_status: 'reserved'
    };
  });

  const newOrder = {
    order_id: nextId(db.orders, 'order_id'),
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_id: user.user_id,
    status: 'pending',
    warehouse: warehouse || '', scene: scene || '',
    borrow_time: new Date().toISOString(),
    expected_return: expected_return || null,
    actual_return: null, purpose: purpose || '',
    require_approval: true,
    created_at: new Date().toISOString(),
    items: items
  };

  for (const toolId of resolvedIds) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
    if (toolIndex > -1) db.tools[toolIndex].status = 'reserved';
  }

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

// 批准订单
router.post('/orders/:id/approve', authenticate, requireApprover, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });
  if (db.orders[orderIndex].status !== 'pending') return res.status(400).json({ message: '只能批准待审核的订单' });

  db.orders[orderIndex].status = 'borrowed';
  for (const item of db.orders[orderIndex].items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'borrowed';
      db.tools[toolIndex].borrow_count = (db.tools[toolIndex].borrow_count || 0) + 1;
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
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) db.tools[toolIndex].status = 'available';
  }
  db.orders[orderIndex].status = 'rejected';
  writeDB(db);
  res.json({ message: '已拒绝' });
});

// 归还订单
router.post('/orders/:id/return', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (order.status !== 'borrowed' && order.status !== 'approved') return res.status(400).json({ message: '只能归还借出中或已批准的订单' });
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能归还自己的订单' });

  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) db.tools[toolIndex].status = 'available';
    item.item_status = 'returned';
  }
  db.orders[orderIndex].status = 'returned';
  db.orders[orderIndex].actual_return = new Date().toISOString();
  writeDB(db);
  res.json({ message: '已归还' });
});

// 取消订单
router.post('/orders/:id/cancel', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) return res.status(404).json({ message: '订单不存在' });

  const order = db.orders[orderIndex];
  if (order.status !== 'pending') return res.status(400).json({ message: '只能取消待审核的订单' });
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能取消自己的订单' });

  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) db.tools[toolIndex].status = 'available';
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
    db.orders[idx].status = 'borrowed';
    for (const item of db.orders[idx].items) {
      const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (ti > -1) { db.tools[ti].status = 'borrowed'; db.tools[ti].borrow_count = (db.tools[ti].borrow_count || 0) + 1; }
      item.item_status = 'borrowed';
    }
  } else if (status === 'rejected') {
    if (order.status !== 'pending') return res.status(400).json({ message: '只能拒绝待审核的订单' });
    if (req.user.role !== 'admin' && req.user.role !== 'team_leader') return res.status(403).json({ message: '无审批权限' });
    for (const item of order.items) {
      const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (ti > -1) db.tools[ti].status = 'available';
    }
    db.orders[idx].status = 'rejected';
  } else if (status === 'cancelled') {
    if (order.status !== 'pending') return res.status(400).json({ message: '只能取消待审核的订单' });
    if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能取消自己的订单' });
    for (const item of order.items) {
      const ti = db.tools.findIndex(t => t.tool_id === item.tool_id);
      if (ti > -1) db.tools[ti].status = 'available';
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
  if (!['returned', 'cancelled', 'rejected'].includes(order.status)) return res.status(400).json({ message: '只能删除已归还、已取消或已拒绝的订单' });
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) return res.status(403).json({ message: '只能删除自己的订单' });

  db.orders.splice(orderIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

module.exports = router;
