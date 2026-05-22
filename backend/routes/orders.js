// 订单管理路由
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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
  if (req.user.role !== 'admin') {
    const user = db.users.find(u => u.user_id === req.user.user_id);
    return res.json(orders.filter(o => o.borrower_name === (user?.real_name || user?.username)));
  }
  res.json(orders);
});

// 创建订单
router.post('/orders', authenticate, [
  body('tool_ids').isArray({ min: 1 }).withMessage('请选择至少要领用的工具'),
  validate
], (req, res) => {
  const { tool_ids, warehouse, scene, expected_return, purpose } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  // 检查工具可用性
  const unavailableTools = [];
  for (const toolId of tool_ids) {
    const tool = db.tools.find(t => t.tool_id === toolId);
    if (!tool) unavailableTools.push(`工具ID ${toolId} 不存在`);
    else if (tool.status !== 'available') unavailableTools.push(`${tool.tool_name} 当前状态为${tool.status}，不可领用`);
  }
  if (unavailableTools.length > 0) {
    return res.status(400).json({ message: unavailableTools.join('；') });
  }

  const orderNo = `ORD${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  let itemCounter = Date.now();
  const items = tool_ids.map(toolId => {
    const tool = db.tools.find(t => t.tool_id === toolId);
    const randomPart = crypto.randomBytes(3).readUIntBE(0, 3);
    return {
      item_id: (itemCounter++ << 12) | (randomPart & 0xFFF),
      tool_id: toolId, tool_code: tool.tool_code, tool_name: tool.tool_name,
      item_status: 'reserved'
    };
  });

  const warehouseRecord = db.warehouses.find(w => w.warehouse_name === warehouse || w.warehouse_code === warehouse);
  const isRestricted = warehouseRecord ? (warehouseRecord.is_restricted !== false) : true;
  const initialStatus = isRestricted ? 'pending' : 'approved';

  const newOrder = {
    order_id: nextId(db.orders, 'order_id'),
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_id: user.user_id,
    status: initialStatus,
    warehouse: warehouse || '', scene: scene || '',
    borrow_time: new Date().toISOString(),
    expected_return: expected_return || null,
    actual_return: null, purpose: purpose || '',
    require_approval: isRestricted,
    created_at: new Date().toISOString(),
    items: items
  };

  for (const toolId of tool_ids) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
    if (toolIndex > -1) db.tools[toolIndex].status = isRestricted ? 'reserved' : 'borrowed';
  }
  if (!isRestricted) items.forEach(item => { item.item_status = 'borrowed'; });

  db.orders.push(newOrder);
  writeDB(db);
  res.json(newOrder);
});

// 批准订单
router.post('/orders/:id/approve', authenticate, requireAdmin, (req, res) => {
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
router.post('/orders/:id/reject', authenticate, requireAdmin, (req, res) => {
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
