/**
 * 安全防护用品 —— 后端接口集成 smoke 测试
 * QA: 严过关 (Edward)
 *
 * 通过 require.cache 注入受控的 db / auth 假模块，挂载【真实】的
 * routes/safetySupplies.js 路由，用 express + fetch 驱动，验证：
 *   - GET 列表 / keyword 模糊搜索
 *   - POST 新增 / 缺字段 / 非法日期的 400 校验拦截
 *   - PUT 修改、DELETE 删除
 *   - GET /settings、PUT /settings（含非法 expiry_alert_days 的 400）
 * 不触碰真实 db.json（使用内存假 db）。
 *
 * 运行： node --test backend/tests/safetySupplies.api.test.mjs
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// structuredClone 为 Node 全局函数，无需 import
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, '..');
const routesDir = join(backendDir, 'routes');
const dbJsPath = join(routesDir, 'db.js');
const authJsPath = join(backendDir, 'middleware', 'auth.js');
const safetySuppliesPath = join(routesDir, 'safetySupplies.js');

const fakeDb = {
  safety_supplies: [],
  settings: { expiry_alert_days: 90 },
};
function fakeModule(exports) {
  return { id: '', filename: '', loaded: true, exports };
}
require.cache[dbJsPath] = fakeModule({
  readDB: () => structuredClone(fakeDb),
  writeDB: (db) => {
    fakeDb.safety_supplies = db.safety_supplies;
    fakeDb.settings = db.settings;
  },
  nextId: (arr, key) => (arr.length ? Math.max(...arr.map((i) => i[key])) + 1 : 1),
  nowCST: () => {
    const n = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}T${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}.000+08:00`;
  },
});
require.cache[authJsPath] = fakeModule({
  authenticate: (req, res, next) => {
    req.user = { user_id: 1, role: 'admin' };
    next();
  },
  requireMaterialManager: (req, res, next) => {
    next();
  },
});

const safetyRouter = require(safetySuppliesPath);

const app = express();
app.use(express.json());
app.use('/api', safetyRouter);

let server;
let base;
before(async () => {
  fakeDb.safety_supplies = [];
  fakeDb.settings = { expiry_alert_days: 90 };
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server?.close();
});

async function call(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(base + path, init);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

describe('列表与模糊搜索', () => {
  before(() => {
    fakeDb.safety_supplies = [];
    fakeDb.settings = { expiry_alert_days: 90 };
  });

  test('GET /safety-supplies 初始返回空数组(200)', async () => {
    const r = await call('GET', '/safety-supplies');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.equal(r.data.length, 0);
  });

  test('keyword 模糊匹配 name/model/brand/manager/user_name（大小写不敏感）', async () => {
    fakeDb.safety_supplies = [
      { supply_id: 1, name: '安全帽A', model: 'M1', brand: '3M', manager: '张三', user_name: '李四', expiry_date: '2027-01-01', check_cycle_days: 90, last_check_date: null, production_date: '', remark: '', created_at: '', updated_at: '' },
      { supply_id: 2, name: '防护手套', model: 'X', brand: 'Honeywell', manager: '王五', user_name: '', expiry_date: '2027-01-01', check_cycle_days: 90, last_check_date: null, production_date: '', remark: '', created_at: '', updated_at: '' },
    ];
    const r = await call('GET', '/safety-supplies?keyword=3m'); // 命中 brand
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].supply_id, 1);

    const r2 = await call('GET', '/safety-supplies?keyword=李四'); // 命中 user_name
    assert.equal(r2.data.length, 1);
    assert.equal(r2.data[0].supply_id, 1);

    const r3 = await call('GET', '/safety-supplies?keyword=zzz'); // 无命中
    assert.equal(r3.data.length, 0);
  });
});

describe('新增（POST）与校验拦截', () => {
  before(() => {
    fakeDb.safety_supplies = [];
    fakeDb.settings = { expiry_alert_days: 90 };
  });

  test('POST 合法新增 → 200 且返回带 supply_id 的完整记录', async () => {
    const r = await call('POST', '/safety-supplies', {
      name: '防毒面具',
      model: 'FM-1',
      brand: '3M',
      production_date: '2026-01-01',
      expiry_date: '2027-06-01',
      manager: '张三',
      user_name: '李四',
      check_cycle_days: 60,
      last_check_date: '2026-02-01',
      remark: '测试',
    });
    assert.equal(r.status, 200, '合法新增应 200');
    assert.ok(typeof r.data.supply_id === 'number', '应返回数值型 supply_id');
    assert.equal(r.data.name, '防毒面具');
    assert.equal(r.data.expiry_date, '2027-06-01');
    assert.equal(r.data.check_cycle_days, 60);
  });

  test('POST 缺 name → 400 校验拦截', async () => {
    const r = await call('POST', '/safety-supplies', { expiry_date: '2027-06-01', manager: '张三' });
    assert.equal(r.status, 400);
  });

  test('POST 缺 manager → 400 校验拦截', async () => {
    const r = await call('POST', '/safety-supplies', { name: 'X', expiry_date: '2027-06-01' });
    assert.equal(r.status, 400);
  });

  test('POST 非法 expiry_date 格式(2026-13-40) → 400 校验拦截', async () => {
    const r = await call('POST', '/safety-supplies', { name: 'X', expiry_date: '2026-13-40', manager: '张三' });
    assert.equal(r.status, 400);
  });

  test('POST 后 GET 列表能查到该记录', async () => {
    const r = await call('GET', '/safety-supplies');
    assert.equal(r.status, 200);
    assert.ok(r.data.some((x) => x.name === '防毒面具'));
  });
});

describe('修改（PUT）与删除（DELETE）', () => {
  let createdId;
  before(async () => {
    fakeDb.safety_supplies = [];
    fakeDb.settings = { expiry_alert_days: 90 };
    const r = await call('POST', '/safety-supplies', { name: '护目镜', expiry_date: '2027-06-01', manager: '张三' });
    createdId = r.data.supply_id;
  });

  test('PUT 修改 name → 200 且字段更新', async () => {
    // 注意：源码 PUT 校验要求 name/expiry_date/manager 均非空，部分更新也需带齐必填字段
    const r = await call('PUT', `/safety-supplies/${createdId}`, {
      name: '护目镜Pro',
      expiry_date: '2027-06-01',
      manager: '张三',
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, '护目镜Pro');
    // 未传字段应保留原值
    assert.equal(r.data.manager, '张三');
    assert.equal(r.data.expiry_date, '2027-06-01');
  });

  test('PUT 不存在的 id → 404', async () => {
    // 带齐校验字段，确保能通过参数校验后命中 404 分支
    const r = await call('PUT', '/safety-supplies/999999', {
      name: 'X',
      expiry_date: '2027-06-01',
      manager: '张三',
    });
    assert.equal(r.status, 404);
  });

  test('DELETE 删除 → 200 且列表不再包含', async () => {
    const r = await call('DELETE', `/safety-supplies/${createdId}`);
    assert.equal(r.status, 200);
    const list = await call('GET', '/safety-supplies');
    assert.equal(list.data.find((x) => x.supply_id === createdId), undefined);
  });

  test('DELETE 不存在的 id → 404', async () => {
    const r = await call('DELETE', '/safety-supplies/999999');
    assert.equal(r.status, 404);
  });
});

describe('全局设置（settings）', () => {
  before(() => {
    fakeDb.safety_supplies = [];
    fakeDb.settings = { expiry_alert_days: 90 };
  });

  test('GET /settings → 返回 { expiry_alert_days }', async () => {
    const r = await call('GET', '/safety-supplies/settings');
    assert.equal(r.status, 200);
    assert.equal(r.data.expiry_alert_days, 90);
  });

  test('PUT /settings 合法值(30) → 200 且更新', async () => {
    const r = await call('PUT', '/safety-supplies/settings', { expiry_alert_days: 30 });
    assert.equal(r.status, 200);
    assert.equal(r.data.expiry_alert_days, 30);
    const r2 = await call('GET', '/safety-supplies/settings');
    assert.equal(r2.data.expiry_alert_days, 30);
  });

  test('PUT /settings 非法值(0) → 400 校验拦截', async () => {
    const r = await call('PUT', '/safety-supplies/settings', { expiry_alert_days: 0 });
    assert.equal(r.status, 400);
  });

  test('PUT /settings 非法值(-5) → 400 校验拦截', async () => {
    const r = await call('PUT', '/safety-supplies/settings', { expiry_alert_days: -5 });
    assert.equal(r.status, 400);
  });
});
