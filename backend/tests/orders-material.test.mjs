// 物料领用单核心逻辑 —— 单测（T02）
// node:test 风格，覆盖：
//  1) deriveOrderType / normalizeOrderItems / getItemRemaining / isHistoricalMaterialOrder 纯函数
//  2) applyMaterialApprove（扣库存 + 写流水 + 库存不足报错）
//  3) applyMaterialReturn（按量归还 + 回补 + 全还/部分还）
//  4) applyMaterialClose（摘要 last_use_qty + 历史单 400）
//  5) orders.js 路由注册（含新增 close 路由）
// 运行：node --test tests/orders-material.test.mjs （或 node tests/orders-material.test.mjs）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  deriveOrderType,
  normalizeOrderItems,
  getItemRemaining,
  isHistoricalMaterialOrder,
  applyMaterialApprove,
  applyMaterialReturn,
  applyMaterialClose
} = await import('../routes/orders-helpers.js');

function makeDb(spares = []) {
  return {
    spare_parts: spares,
    stock_movements: [],
    material_categories: [],
    warehouses: [],
    shelves: [],
    storage_locations: [],
    tools: [],
    users: [],
    orders: []
  };
}

const operator = { user_id: 1, real_name: '管理员', username: 'admin' };

// ============ deriveOrderType ============
test('deriveOrderType：有 order_type 字段用之', () => {
  assert.equal(deriveOrderType({ order_type: 'material', items: [] }), 'material');
  assert.equal(deriveOrderType({ order_type: 'tool', items: [{ item_type: 'spare' }] }), 'tool');
});

test('deriveOrderType：无字段时 items 含 spare → material', () => {
  assert.equal(deriveOrderType({ items: [{ item_type: 'spare' }] }), 'material');
  assert.equal(deriveOrderType({ items: [{ item_type: 'consumable' }] }), 'material');
});

test('deriveOrderType：无字段时纯工具 → tool；空订单 → tool', () => {
  assert.equal(deriveOrderType({ items: [{ item_type: 'tool' }] }), 'tool');
  assert.equal(deriveOrderType({ items: [{ tool_id: 1 }] }), 'tool');
  assert.equal(deriveOrderType({ items: [] }), 'tool');
  assert.equal(deriveOrderType(null), 'tool');
});

// ============ normalizeOrderItems ============
test('normalizeOrderItems：item_type 缺省 tool，工具条目不动', () => {
  const items = normalizeOrderItems([{ item_id: 1, tool_id: 1, item_status: 'reserved' }]);
  assert.equal(items[0].item_type, 'tool');
  assert.equal(items[0].borrow_qty, undefined);
});

test('normalizeOrderItems：备件补 borrow_qty=||1、returned_qty=||0、return_records=||[]', () => {
  const items = normalizeOrderItems([{ item_id: 1, item_type: 'spare', spare_id: 1, item_status: 'reserved' }]);
  assert.equal(items[0].borrow_qty, 1);
  assert.equal(items[0].returned_qty, 0);
  assert.deepEqual(items[0].return_records, []);
});

test('normalizeOrderItems：已有值保留', () => {
  const rec = [{ return_id: 1, return_qty: 1 }];
  const items = normalizeOrderItems([{ item_id: 1, item_type: 'spare', spare_id: 1, borrow_qty: 3, returned_qty: 1, return_records: rec }]);
  assert.equal(items[0].borrow_qty, 3);
  assert.equal(items[0].returned_qty, 1);
  assert.deepEqual(items[0].return_records, rec);
});

// ============ getItemRemaining ============
test('getItemRemaining：borrow - returned，最小 0', () => {
  assert.equal(getItemRemaining({ borrow_qty: 5, returned_qty: 2 }), 3);
  assert.equal(getItemRemaining({ borrow_qty: 2, returned_qty: 0 }), 2);
  assert.equal(getItemRemaining({ borrow_qty: 2, returned_qty: 5 }), 0);
  assert.equal(getItemRemaining({}), 1, '缺省 borrow_qty=1');
});

// ============ isHistoricalMaterialOrder ============
test('isHistoricalMaterialOrder：物料条目无 borrow_qty → true', () => {
  assert.equal(isHistoricalMaterialOrder({ items: [{ item_type: 'spare', spare_id: 1 }] }), true);
});

test('isHistoricalMaterialOrder：有 borrow_qty → false；工具单 → false', () => {
  assert.equal(isHistoricalMaterialOrder({ items: [{ item_type: 'spare', spare_id: 1, borrow_qty: 1 }] }), false);
  assert.equal(isHistoricalMaterialOrder({ items: [{ tool_id: 1 }] }), false);
});

// ============ applyMaterialApprove ============
test('approve：扣减 stock_qty + 写 out 流水 + 置 borrowed', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 5, borrow_count: 0 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'pending', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'reserved', borrow_qty: 3 }] };
  const result = applyMaterialApprove(db, order, operator);
  assert.equal(result.ok, true);
  assert.equal(db.spare_parts[0].stock_qty, 2, '5-3=2');
  assert.equal(db.spare_parts[0].borrow_count, 1);
  assert.equal(order.status, 'borrowed');
  assert.equal(order.items[0].item_status, 'borrowed');
  assert.equal(db.stock_movements.length, 1);
  assert.equal(db.stock_movements[0].movement_type, 'out');
  assert.equal(db.stock_movements[0].qty, -3);
  assert.equal(db.stock_movements[0].order_id, 10);
  assert.match(db.stock_movements[0].remark, /物料领用-借出扣减/);
});

test('approve：库存不足 → ok:false 且不扣减不写流水', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 2, borrow_count: 0 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'pending', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'reserved', borrow_qty: 3 }] };
  const result = applyMaterialApprove(db, order, operator);
  assert.equal(result.ok, false);
  assert.match(result.error, /库存不足/);
  assert.equal(db.spare_parts[0].stock_qty, 2, '库存不变');
  assert.equal(db.stock_movements.length, 0);
  assert.equal(order.status, 'pending', '保持 pending 由管理员处置');
});

// ============ applyMaterialReturn ============
test('return：部分归还回补库存 + 累计 returned_qty + 保持 borrowed', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 2 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'borrowed', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 0, return_records: [] }] };
  const result = applyMaterialReturn(db, order, operator, [{ spare_id: 1, return_qty: 2 }]);
  assert.equal(result.ok, true);
  assert.equal(result.allReturned, false);
  assert.equal(db.spare_parts[0].stock_qty, 4, '2+2=4');
  assert.equal(order.items[0].returned_qty, 2);
  assert.equal(order.items[0].return_records.length, 1);
  assert.equal(order.status, 'borrowed', '部分归还保持 borrowed');
  assert.equal(db.stock_movements[0].movement_type, 'in');
  assert.equal(db.stock_movements[0].qty, 2);
  assert.match(db.stock_movements[0].remark, /物料归还-回补/);
});

test('return：按 item_id 路径部分归还（兼容，QA 修复）', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 5 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'borrowed', items: [{ item_id: 999001, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 0, return_records: [] }] };
  const result = applyMaterialReturn(db, order, operator, [{ item_id: 999001, return_qty: 2 }]);
  assert.equal(result.ok, true);
  assert.equal(result.allReturned, false);
  assert.equal(db.spare_parts[0].stock_qty, 7, '5+2=7（部分归还，非全还 10）');
  assert.equal(order.items[0].returned_qty, 2);
  assert.equal(order.status, 'borrowed', 'item_id 路径部分归还后仍 borrowed');
  assert.equal(order.items[0].return_records[0].return_qty, 2);
});

test('return：缺省 returns → 全还，status=returned', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 2 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'borrowed', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 0, return_records: [] }] };
  const result = applyMaterialReturn(db, order, operator, undefined);
  assert.equal(result.ok, true);
  assert.equal(result.allReturned, true);
  assert.equal(db.spare_parts[0].stock_qty, 7);
  assert.equal(order.items[0].returned_qty, 5);
  assert.equal(order.status, 'returned');
  assert.ok(order.actual_return);
});

test('return：归还数量非法（>剩余）→ ok:false', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 2 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'borrowed', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 0, return_records: [] }] };
  const result = applyMaterialReturn(db, order, operator, [{ spare_id: 1, return_qty: 6 }]);
  assert.equal(result.ok, false);
  assert.match(result.error, /归还数量非法/);
});

test('return：多行单逐项单独归还 —— 未列条目不被连带全额归还（回归）', () => {
  const db = makeDb([
    { spare_id: 1, spare_code: 'BJ-1', spare_name: '螺栓', stock_qty: 10 },
    { spare_id: 2, spare_code: 'BJ-2', spare_name: '垫片', stock_qty: 10 }
  ]);
  const order = {
    order_id: 10, order_no: 'ORD1', status: 'borrowed',
    items: [
      { item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '螺栓', item_status: 'borrowed', borrow_qty: 3, returned_qty: 0, return_records: [] },
      { item_id: 2, item_type: 'spare', spare_id: 2, spare_code: 'BJ-2', spare_name: '垫片', item_status: 'borrowed', borrow_qty: 2, returned_qty: 0, return_records: [] }
    ]
  };
  // 仅归还「螺栓」1 件（前端 spareReturn 只传这一项）
  const result = applyMaterialReturn(db, order, operator, [{ spare_id: 1, return_qty: 1 }]);
  assert.equal(result.ok, true);
  assert.equal(result.allReturned, false);
  // 螺栓：部分归还 → 库存 +1、returned=1
  assert.equal(db.spare_parts[0].stock_qty, 11, '螺栓 10+1=11');
  assert.equal(order.items[0].returned_qty, 1);
  // 垫片：未被牵连 → 库存不变、returned=0（修复前会误判为全额归还使库存回 10、returned=2）
  assert.equal(db.spare_parts[1].stock_qty, 10, '垫片库存不受影响');
  assert.equal(order.items[1].returned_qty, 0, '垫片未被连带归还');
  assert.equal(order.status, 'borrowed', '仍借出中');
});

// ============ applyMaterialClose ============
test('close：摘要 last_use_qty=borrow-returned，仅未还部分写流水，status=closed', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 3 }]);
  const order = {
    order_id: 10, order_no: 'ORD1', status: 'borrowed',
    items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 2, return_records: [] }]
  };
  const result = applyMaterialClose(db, order, operator);
  assert.equal(result.ok, true);
  assert.equal(order.status, 'closed');
  assert.equal(order.closed, true);
  assert.ok(order.closed_at);
  assert.equal(order.items[0].item_status, 'closed');
  assert.equal(order.items[0].last_use_qty, 3, '5-2=3');
  assert.equal(result.summary[0].last_use_qty, 3);
  assert.equal(db.stock_movements.length, 1, '仅未还部分写流水');
  assert.equal(db.stock_movements[0].qty, -3);
  assert.match(db.stock_movements[0].remark, /物料关闭-最后使用\(仅统计\)/);
  assert.equal(db.spare_parts[0].stock_qty, 3, 'close 不重复扣库存');
});

test('close：已全部归还 → last_use_qty=0 且不写流水', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 3 }]);
  const order = {
    order_id: 10, order_no: 'ORD1', status: 'borrowed',
    items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed', borrow_qty: 5, returned_qty: 5, return_records: [] }]
  };
  const result = applyMaterialClose(db, order, operator);
  assert.equal(result.ok, true);
  assert.equal(result.summary[0].last_use_qty, 0);
  assert.equal(db.stock_movements.length, 0);
});

test('close：历史单（无 borrow_qty）→ 400 提示联系管理员', () => {
  const db = makeDb([{ spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', stock_qty: 3 }]);
  const order = { order_id: 10, order_no: 'ORD1', status: 'borrowed', items: [{ item_id: 1, item_type: 'spare', spare_id: 1, spare_code: 'BJ-1', spare_name: '备件一', item_status: 'borrowed' }] };
  const result = applyMaterialClose(db, order, operator);
  assert.equal(result.ok, false);
  assert.match(result.error, /联系管理员/);
});

// ============ orders.js 路由注册（含新增 close） ============
let ordersRouter = null;
let ordersLoadError = null;
try {
  ordersRouter = (await import('../routes/orders.js')).default;
} catch (e) {
  ordersLoadError = e;
}

test('orders.js 模块可加载（无语法/引用错误）', () => {
  assert.equal(ordersLoadError, null, 'orders.js 加载失败: ' + (ordersLoadError && ordersLoadError.message));
  assert.ok(ordersRouter && typeof ordersRouter === 'function');
});

test('orders.js 已注册 POST /orders/:id/close 路由', () => {
  assert.ok(ordersRouter && ordersRouter.stack, 'router.stack 不存在');
  const layer = ordersRouter.stack.find(l => l.route && String(l.route.path).endsWith('/close') && l.route.methods.post === true);
  assert.ok(layer, '应在 router.stack 中找到 POST /orders/:id/close 路由');
});
