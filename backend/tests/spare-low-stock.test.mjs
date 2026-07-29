// 物料最低库存设置 —— 增量功能测试（QA：严过关 Yan）
// 仅依赖 Node 内置 assert / module，不引入任何新依赖。
//
// 覆盖：
//  1) computeSpareLowStock / buildSpareModelMap 纯函数单测
//  2) GET /spare-parts/low-stock 路由注册断言
//  3) materials.js 模块可加载（无语法/引用错误、依赖可加载）
//
// 运行：node backend/tests/spare-low-stock.test.mjs

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---- 顶层动态导入（便于受控捕获加载失败，给出 PASS/FAIL 而非硬崩溃） ----
let router = null;
let loadError = null;
try {
  router = (await import('../routes/materials.js')).default;
} catch (e) {
  loadError = e;
}

// ---- 极简测试框架 ----
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ============ 模块加载测试 ============
test('模块加载：require materials.js 不抛错（无语法/引用错误、依赖可加载）', () => {
  assert.equal(loadError, null, 'materials.js 加载失败: ' + (loadError && loadError.message));
  assert.ok(router, 'module.exports 不应为空');
  assert.equal(typeof router, 'function', 'router 应为 Express Router 函数');
  assert.ok(Array.isArray(router.stack), 'router.stack 应为数组（Express 路由栈）');
});

// 即便上面加载失败，也继续对纯函数导出做断言（若未导出则明确报错）
const computeSpareLowStock = router && router.computeSpareLowStock;
const buildSpareModelMap = router && router.buildSpareModelMap;

test('纯函数已安全导出（module.exports.computeSpareLowStock / buildSpareModelMap）', () => {
  assert.equal(typeof computeSpareLowStock, 'function', 'computeSpareLowStock 应被导出为函数');
  assert.equal(typeof buildSpareModelMap, 'function', 'buildSpareModelMap 应被导出为函数');
});

// ============ buildSpareModelMap 单测 ============
test('buildSpareModelMap：model===\'\' 的旧 lone 项被忽略', () => {
  const map = buildSpareModelMap([{ spare_id: 1, model: '', status: 'available', warning_qty: null }]);
  assert.equal(map.size, 0, '空 model 不应进入聚合');
});

test('buildSpareModelMap：available_count 只数 status===\'available\'（borrowed/reserved 不计）', () => {
  const map = buildSpareModelMap([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 5 },
    { spare_id: 2, model: 'M1', status: 'borrowed', warning_qty: 5 },
    { spare_id: 3, model: 'M1', status: 'reserved', warning_qty: 5 },
  ]);
  assert.equal(map.get('M1').available_count, 1, '仅 available 计入，borrowed/reserved 不计');
});

test('buildSpareModelMap：warning_qty 取同组首件值', () => {
  const map = buildSpareModelMap([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 3 },
    { spare_id: 2, model: 'M1', status: 'available', warning_qty: 99 },
  ]);
  assert.equal(map.get('M1').warning_qty, 3, '预警值应取同组首件值');
});

test('buildSpareModelMap：多件不同 model 分组正确', () => {
  const map = buildSpareModelMap([
    { spare_id: 1, model: 'A', status: 'available', warning_qty: 5 },
    { spare_id: 2, model: 'A', status: 'available', warning_qty: 5 },
    { spare_id: 3, model: 'B', status: 'available', warning_qty: 2 },
  ]);
  assert.equal(map.size, 2, '应聚合出 2 个型号');
  assert.equal(map.get('A').available_count, 2);
  assert.equal(map.get('B').available_count, 1);
});

test('buildSpareModelMap：warning_qty=null 正确存为 null', () => {
  const map = buildSpareModelMap([{ spare_id: 1, model: 'M1', status: 'available', warning_qty: null }]);
  assert.strictEqual(map.get('M1').warning_qty, null);
});

test('buildSpareModelMap：空/ null 输入安全返回空 Map', () => {
  assert.equal(buildSpareModelMap(null).size, 0);
  assert.equal(buildSpareModelMap([]).size, 0);
});

// ============ computeSpareLowStock 单测 ============
test('computeSpareLowStock：同 model 2 件 available、warning 3 → 低库存', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 3 },
    { spare_id: 2, model: 'M1', status: 'available', warning_qty: 3 },
  ]);
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], { model: 'M1', available_count: 2, warning_qty: 3, spare_ids: [1, 2] });
});

test('computeSpareLowStock：1 件 available、warning 1 → 不低（相等不触发）', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 1 },
  ]);
  assert.equal(res.length, 0, 'available_count(1) 不 < warning_qty(1)');
});

test('computeSpareLowStock：1 件 available、warning 2 → 低库存', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 2 },
  ]);
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], { model: 'M1', available_count: 1, warning_qty: 2, spare_ids: [1] });
});

test('computeSpareLowStock：model===\'\' 的 lone 项被忽略（不误报低库存）', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: '', status: 'available', warning_qty: 0 },
  ]);
  assert.equal(res.length, 0, '空 model 不参与低库存判定');
});

test('computeSpareLowStock：多型号 — 仅真正低于预警的型号进入结果', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'A', status: 'available', warning_qty: 5 }, // 1<5 → 低
    { spare_id: 2, model: 'B', status: 'available', warning_qty: 1 }, // 1<1 → 不低
    { spare_id: 3, model: 'B', status: 'available', warning_qty: 1 }, // 2<1 → 不低
  ]);
  assert.equal(res.length, 1, '仅型号 A 低库存');
  assert.equal(res[0].model, 'A');
  assert.deepEqual(res[0].spare_ids, [1]);
});

test('computeSpareLowStock：warning_qty=null 不预警', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: null },
  ]);
  assert.equal(res.length, 0, '未设置最低库存的型号不预警');
});

test('computeSpareLowStock：spare_ids 正确收集 available 件 id（borrowed 排除）', () => {
  const res = computeSpareLowStock([
    { spare_id: 1, model: 'M1', status: 'available', warning_qty: 5 },
    { spare_id: 2, model: 'M1', status: 'borrowed', warning_qty: 5 },
    { spare_id: 3, model: 'M1', status: 'available', warning_qty: 5 },
  ]);
  assert.equal(res.length, 1);
  assert.equal(res[0].available_count, 2, 'available_count 只数 available');
  assert.deepEqual(res[0].spare_ids, [1, 3], 'spare_ids 仅含 available 件');
});

test('computeSpareLowStock：空/ null 输入安全返回空数组', () => {
  assert.deepEqual(computeSpareLowStock(null), []);
  assert.deepEqual(computeSpareLowStock([]), []);
});

// ============ 路由注册测试 ============
test('路由注册：已注册 GET /spare-parts/low-stock（路径含 low-stock 且 method=GET）', () => {
  assert.ok(router && router.stack, 'router.stack 不存在');
  const layer = router.stack.find(l => {
    if (!l.route) return false;
    const p = l.route.path;
    const methods = l.route.methods || {};
    return typeof p === 'string' && p.includes('low-stock') && methods.get === true;
  });
  assert.ok(layer, '应在 router.stack 中找到 GET /spare-parts/low-stock 路由');
  assert.ok(layer.route.path.includes('low-stock'), '匹配的路由路径应包含 low-stock');
});

test('路由注册：low-stock 路由在 /spare-parts/code/:code 之前或独立存在，路径不被 code 参数吞掉', () => {
  const lowStock = router.stack.find(l => l.route && l.route.path === '/spare-parts/low-stock');
  assert.ok(lowStock, '存在精确路径 /spare-parts/low-stock 的路由层');
  assert.equal(lowStock.route.methods.get, true);
});

// ============ 运行 ============
let passed = 0;
let failed = 0;
const failures = [];

console.log('\n物料最低库存设置 —— 测试开始\n');
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log('  ✓ ' + t.name);
  } catch (e) {
    failed++;
    failures.push({ name: t.name, err: e });
    console.log('  ✗ ' + t.name);
    console.log('      ' + e.message);
  }
}

console.log(`\n=== 测试结果：通过 ${passed} / 失败 ${failed} （共 ${tests.length}） ===`);
if (failed > 0) {
  console.log('\n失败详情:');
  for (const f of failures) {
    console.log('- ' + f.name + ': ' + f.err.message);
    if (f.err.stack) {
      const detail = f.err.stack.split('\n').slice(1, 4).join('\n').trim();
      if (detail) console.log('    ' + detail);
    }
  }
  process.exit(1);
} else {
  console.log('ALL PASS ✅');
}
