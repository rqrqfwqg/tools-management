// 订单核心逻辑辅助（物料领用单：按数量库存模型）
// 纯函数集合，供 orders.js 路由与单测复用。
// 依赖 materials.js 导出的 writeMovement 写出入库流水（复用 out/in/adjust 枚举，不新增）。
//
// 数量语义：
//   borrow_qty  借出数量
//   returned_qty 累计已归还
//   return_records 归还明细
//   last_use_qty = borrow_qty - returned_qty（关闭时自动计算）
//   剩余可还 = borrow_qty - returned_qty
//
// 状态流转（物料单）：pending → borrowed →(部分归还保持 borrowed)→ closed 终态
const { writeMovement } = require('./materials');
const { nextId, nowCST } = require('./db');

/**
 * 订单类型推导（纯函数）。
 * 有 order_type 用之；否则 items 含 spare/consumable → 'material'，否则 'tool'。不写库回填。
 * @param {Object} order
 * @returns {'tool'|'material'}
 */
function deriveOrderType(order) {
  if (!order) return 'tool';
  if (order.order_type === 'material' || order.order_type === 'tool') return order.order_type;
  const items = order.items || [];
  if (items.some(i => i.item_type === 'spare' || i.item_type === 'consumable')) return 'material';
  return 'tool';
}

/**
 * 条目归一化（纯函数，返回新数组）。
 * item_type 缺省 'tool'；备件/消耗品补 borrow_qty=||1、returned_qty=||0、return_records=||[]。
 * @param {Array} items
 * @returns {Array}
 */
function normalizeOrderItems(items) {
  return (items || []).map(item => {
    const item_type = item.item_type || 'tool';
    const normalized = { ...item, item_type };
    if (item_type === 'spare' || item_type === 'consumable') {
      normalized.borrow_qty = item.borrow_qty != null ? Number(item.borrow_qty) : 1;
      normalized.returned_qty = item.returned_qty != null ? Number(item.returned_qty) : 0;
      normalized.return_records = Array.isArray(item.return_records) ? item.return_records : [];
    }
    return normalized;
  });
}

/**
 * 剩余可还数量（纯函数）：borrow_qty - returned_qty，最小 0。
 * @param {Object} item
 * @returns {number}
 */
function getItemRemaining(item) {
  const borrow = item.borrow_qty != null ? Number(item.borrow_qty) : 1;
  const returned = item.returned_qty != null ? Number(item.returned_qty) : 0;
  return Math.max(0, borrow - returned);
}

/**
 * 历史物料单判定（纯函数）：物料条目未携带 borrow_qty（本特性上线前创建）。
 * 历史单可归还（默认 borrow_qty=1），但关闭时拦截 400 提示联系管理员。
 * @param {Object} order
 * @returns {boolean}
 */
function isHistoricalMaterialOrder(order) {
  if (deriveOrderType(order) !== 'material') return false;
  return (order.items || []).some(i => (i.item_type === 'spare' || i.item_type === 'consumable') && i.borrow_qty == null);
}

/**
 * 物料单审批：强校验库存→扣减 stock_qty→写 out 流水→置 borrowed。
 * 库存不足返回 { ok:false, error }，订单保持 pending 由管理员处置；不抛异常。
 * @param {Object} db
 * @param {Object} order 会被就地归一化并置 borrowed
 * @param {Object} operator 当前操作者（含 user_id/real_name/username）
 * @returns {{ok:boolean, error?:string, order?:Object}}
 */
function applyMaterialApprove(db, order, operator) {
  order.items = normalizeOrderItems(order.items);
  const operatorName = operator?.real_name || operator?.username || '';
  // 强校验：每条备件 stock_qty >= borrow_qty
  for (const item of order.items) {
    if (item.item_type !== 'spare') continue;
    const sp = (db.spare_parts || []).find(s => s.spare_id === item.spare_id);
    if (!sp) return { ok: false, error: `备件 ${item.spare_name || item.spare_code || item.spare_id} 不存在` };
    if (Number(sp.stock_qty) < item.borrow_qty) {
      return { ok: false, error: `备件「${sp.spare_name}」库存不足（需 ${item.borrow_qty}，现有 ${sp.stock_qty}），订单保持待审核` };
    }
  }
  for (const item of order.items) {
    if (item.item_type !== 'spare') continue;
    const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
    if (idx > -1) {
      db.spare_parts[idx].stock_qty = Number(db.spare_parts[idx].stock_qty) - item.borrow_qty;
      db.spare_parts[idx].borrow_count = (db.spare_parts[idx].borrow_count || 0) + 1;
      // 兼容旧 status 字段（扫码借出曾置 reserved）：审批通过后置 borrowed，与旧流程一致
      db.spare_parts[idx].status = 'borrowed';
    }
    writeMovement(db, {
      item_type: 'spare', item_id: item.spare_id, item_code: item.spare_code, item_name: item.spare_name,
      movement_type: 'out', qty: -item.borrow_qty, operator_id: operator?.user_id, operator_name: operatorName,
      order_id: order.order_id, remark: '物料领用-借出扣减'
    });
    item.item_status = 'borrowed';
  }
  order.status = 'borrowed';
  return { ok: true, order };
}

/**
 * 物料单归还：按 returns 逐条回补库存并累计 returned_qty/return_records。
 * returns 缺省（空/未传）= 全额归还全部；提供 returns 时仅归还所列条目，
 * 未列条目保持不变（支持逐项单独归还，避免多行单被连带全额归还）。
 * 全部归还后 status='returned' 并写 actual_return；否则保持 'borrowed'。
 * @param {Object} db
 * @param {Object} order 会被就地归一化并更新
 * @param {Object} operator
 * @param {Array} [returns]
 * @returns {{ok:boolean, error?:string, order?:Object, allReturned?:boolean}}
 */
function applyMaterialReturn(db, order, operator, returns) {
  order.items = normalizeOrderItems(order.items);
  // 是否显式指定了归还明细：显式时仅归还所列条目，未列条目保持不变（支持逐项单独归还）；
  // 未提供 returns（或缺省空数组）则视为「全额归还全部」。
  const explicit = Array.isArray(returns) && returns.length > 0;
  const returnMap = new Map();
  for (const r of (returns || [])) {
    const key = r.spare_id != null ? `spare-${r.spare_id}` : (r.item_id != null ? `item-${r.item_id}` : null);
    if (key != null) returnMap.set(key, Number(r.return_qty));
  }
  const operatorName = operator?.real_name || operator?.username || '';
  let allReturned = true;
  for (const item of order.items) {
    if (item.item_type !== 'spare') continue;
    const remaining = getItemRemaining(item);
    // 兼容两种 key：item_id 优先，spare_id 兜底（前端实际用 spare_id，调用方可任选）
    const keyByItemId = item.item_id != null ? `item-${item.item_id}` : null;
    const keyBySpareId = `spare-${item.spare_id}`;
    let returnQty;
    if (explicit) {
      // 仅归还明确列出的备件；未列出的保持不变（不再默认全额归还，避免多行单被连带）
      if (keyByItemId != null && returnMap.has(keyByItemId)) returnQty = returnMap.get(keyByItemId);
      else if (returnMap.has(keyBySpareId)) returnQty = returnMap.get(keyBySpareId);
      else returnQty = 0;
    } else {
      // 未传 returns：全额归还全部条目
      returnQty = remaining;
    }
    if (!Number.isInteger(returnQty) || returnQty < 0 || returnQty > remaining) {
      return { ok: false, error: `备件「${item.spare_name || item.spare_code}」归还数量非法（可还 ${remaining}）` };
    }
    if (returnQty === 0) {
      if (remaining > 0) allReturned = false;
      continue;
    }
    const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
    if (idx > -1) {
      db.spare_parts[idx].stock_qty = Number(db.spare_parts[idx].stock_qty) + returnQty;
      // 兼容旧 status 字段：全部归还后恢复 available
      if (remaining - returnQty === 0) db.spare_parts[idx].status = 'available';
    }
    item.returned_qty = (Number(item.returned_qty) || 0) + returnQty;
    item.return_records = Array.isArray(item.return_records) ? item.return_records : [];
    item.return_records.push({
      return_id: nextId(item.return_records, 'return_id'),
      item_id: item.item_id, spare_id: item.spare_id,
      return_qty: returnQty, returned_at: nowCST(), returned_by: operatorName
    });
    writeMovement(db, {
      item_type: 'spare', item_id: item.spare_id, item_code: item.spare_code, item_name: item.spare_name,
      movement_type: 'in', qty: returnQty, operator_id: operator?.user_id, operator_name: operatorName,
      order_id: order.order_id, remark: '物料归还-回补'
    });
    if (getItemRemaining(item) > 0) allReturned = false;
  }
  order.status = allReturned ? 'returned' : 'borrowed';
  if (allReturned) order.actual_return = nowCST();
  return { ok: true, order, allReturned };
}

/**
 * 物料单关闭（终态）：历史单 400；last_use_qty=borrow_qty-returned_qty 自动算；
 * 写 out 流水「物料关闭-最后使用(仅统计)」不重复扣库存；status='closed'、closed_at、条目 item_status='closed'。
 * @param {Object} db
 * @param {Object} order 会被就地归一化并更新
 * @param {Object} operator
 * @returns {{ok:boolean, error?:string, order?:Object, summary?:Array}}
 */
function applyMaterialClose(db, order, operator) {
  if (isHistoricalMaterialOrder(order)) {
    return { ok: false, error: '历史物料单不支持关闭，请联系管理员处理' };
  }
  if (order.status === 'closed') return { ok: false, error: '订单已关闭' };
  order.items = normalizeOrderItems(order.items);
  const operatorName = operator?.real_name || operator?.username || '';
  const summary = [];
  for (const item of order.items) {
    if (item.item_type !== 'spare') continue;
    const lastUseQty = getItemRemaining(item); // borrow - returned
    item.last_use_qty = lastUseQty;
    item.item_status = 'closed';
    // 兼容旧 status 字段：关闭后该备件不再占用，恢复 available
    const idx = (db.spare_parts || []).findIndex(s => s.spare_id === item.spare_id);
    if (idx > -1) db.spare_parts[idx].status = 'available';
    summary.push({
      item_id: item.item_id, spare_id: item.spare_id, spare_code: item.spare_code, spare_name: item.spare_name,
      borrow_qty: item.borrow_qty, returned_qty: item.returned_qty, last_use_qty: lastUseQty
    });
    if (lastUseQty > 0) {
      writeMovement(db, {
        item_type: 'spare', item_id: item.spare_id, item_code: item.spare_code, item_name: item.spare_name,
        movement_type: 'out', qty: -lastUseQty, operator_id: operator?.user_id, operator_name: operatorName,
        order_id: order.order_id, remark: '物料关闭-最后使用(仅统计)'
      });
    }
  }
  order.status = 'closed';
  order.closed = true;
  order.closed_at = nowCST();
  return { ok: true, order, summary };
}

module.exports = {
  deriveOrderType,
  normalizeOrderItems,
  getItemRemaining,
  isHistoricalMaterialOrder,
  applyMaterialApprove,
  applyMaterialReturn,
  applyMaterialClose
};
