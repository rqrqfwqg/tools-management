/**
 * 安全防护用品 —— 核心提醒逻辑测试（优先级最高）
 * QA: 严过关 (Edward)
 *
 * 设计：
 *   1) 「等价实现验证」段 —— 按需求规格（days_to_expiry = 到期日 - 今天）独立实现一遍正确逻辑并断言，
 *      作为期望行为的基准锚点（不依赖源码，避免把源码 bug 带进来）。
 *   2) 「真实源码测试」段 —— 通过 require.cache 注入受控的 db / auth 假模块，
 *      挂载【真实】的 routes/safetySupplies.js 路由，用 express + fetch 直接驱动，
 *      断言真实代码的返回。此处会暴露源码 bug。
 *
 * 运行： node --test backend/tests/safetySupplies.alerts.test.mjs
 * 说明： 不直接触碰 db.json（使用注入的内存假 db），测试之间互不影响。
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

// ---------------- 受控假模块（注入 require.cache，避免触碰真实 db.json） ----------------
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
// 受控鉴权中间件：直接放行并视为 admin（避免依赖真实 JWT）
require.cache[authJsPath] = fakeModule({
  authenticate: (req, res, next) => {
    req.user = { user_id: 1, role: 'admin' };
    next();
  },
  requireMaterialManager: (req, res, next) => {
    next();
  },
});

// 挂载【真实】路由
const safetyRouter = require(safetySuppliesPath);

const app = express();
app.use(express.json());
app.use('/api', safetyRouter);

let server;
let base;
before(async () => {
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
    /* 某些错误响应可能没有 body */
  }
  return { status: res.status, data };
}

// ---------------- 与后端语义一致的日期工具（仅供测试构造数据使用） ----------------
function todayCST() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
function addDays(dateStr, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10);
}
function toMs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getTime();
}
// 需求规格的【正确】天数逻辑：days_to_expiry = 到期日 - 今天
function correctDaysToExpiry(expiry, today) {
  return Math.round((toMs(expiry) - toMs(today)) / 86400000);
}

// ====================================================================
// 段 1：等价实现验证（基于需求规格，独立正确实现，作为期望基准）
// ====================================================================
describe('等价实现验证（需求规格正确逻辑，独立于源码）', () => {
  const today = todayCST();

  test('到期日=今天 → days_to_expiry=0，expiring_soon=true(默认90)', () => {
    const d = correctDaysToExpiry(today, today);
    assert.equal(d, 0);
    assert.ok(d >= 0 && d <= 90);
  });

  test('到期日=今天+90 → 边界 expiring_soon=true', () => {
    const d = correctDaysToExpiry(addDays(today, 90), today);
    assert.equal(d, 90);
    assert.ok(d >= 0 && d <= 90);
  });

  test('到期日=今天+91 → expiring_soon=false', () => {
    const d = correctDaysToExpiry(addDays(today, 91), today);
    assert.equal(d, 91);
    assert.ok(!(d >= 0 && d <= 90));
  });

  test('到期日=今天-1 → expired=true', () => {
    const d = correctDaysToExpiry(addDays(today, -1), today);
    assert.equal(d, -1);
    assert.ok(d < 0);
  });

  test('定期检查：last_check_date 为空 → check_due=true', () => {
    const lc = null;
    const next = lc == null ? null : addDays(lc, 90);
    assert.equal(next, null);
    assert.equal(next == null ? true : next <= today, true);
  });

  test('定期检查：last_check=今天-周期 → check_due=true', () => {
    const cycle = 90;
    const lc = addDays(today, -cycle);
    const next = addDays(lc, cycle); // = 今天
    assert.equal(next, today);
    assert.equal(next <= today, true);
  });

  test('定期检查：last_check=今天 → check_due=false', () => {
    const cycle = 90;
    const lc = today;
    const next = addDays(lc, cycle); // = 今天+周期
    assert.ok(next > today);
    assert.equal(next <= today, false);
  });

  test('调整 expiry_alert_days=30：到期日=今天+60 → expiring_soon=false', () => {
    const alert = 30;
    const d = correctDaysToExpiry(addDays(today, 60), today);
    assert.ok(!(d >= 0 && d <= alert));
  });

  test('调整 expiry_alert_days=30：到期日=今天+20 → expiring_soon=true', () => {
    const alert = 30;
    const d = correctDaysToExpiry(addDays(today, 20), today);
    assert.ok(d >= 0 && d <= alert);
  });
});

// ====================================================================
// 段 2：真实源码测试（驱动真实 safetySupplies.js 路由）
// ====================================================================
function makeSupply(id, over = {}) {
  return {
    supply_id: id,
    name: 'S' + id,
    model: '',
    brand: '',
    production_date: '',
    expiry_date: '',
    manager: 'M',
    user_name: '',
    check_cycle_days: 90,
    last_check_date: null,
    remark: '',
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('真实源码：GET /api/safety-supplies/alerts（驱动真实路由）', () => {
  const today = todayCST();

  // 每个用例独立设置假 db，避免相互干扰
  async function getAlertsWith(supplies, settings) {
    fakeDb.safety_supplies = supplies;
    fakeDb.settings = settings || { expiry_alert_days: 90 };
    const r = await call('GET', '/safety-supplies/alerts');
    assert.equal(r.status, 200, 'alerts 应返回 200');
    return r.data;
  }

  test('到期日=今天 → 出现在 expiring，days_to_expiry=0', async () => {
    const data = await getAlertsWith([makeSupply(1, { expiry_date: today })], { expiry_alert_days: 90 });
    const item = data.expiring.find((x) => x.supply_id === 1);
    assert.ok(item, '今天到期用品应进入 expiring 列表');
    assert.equal(item.days_to_expiry, 0);
  });

  test('到期日=今天+90（默认90）→ 出现在 expiring，days_to_expiry=+90（关键：应为正）', async () => {
    const data = await getAlertsWith([makeSupply(2, { expiry_date: addDays(today, 90) })], { expiry_alert_days: 90 });
    const item = data.expiring.find((x) => x.supply_id === 2);
    assert.ok(item, '今天+90 到期用品应进入 expiring 列表');
    assert.equal(item.days_to_expiry, 90, 'days_to_expiry 应为 +90（到期日-今天），源码若给 -90 即符号反了');
  });

  test('到期日=今天+91（默认90）→ 不应出现在 expiring（未超提醒窗口）', async () => {
    const data = await getAlertsWith([makeSupply(3, { expiry_date: addDays(today, 91) })], { expiry_alert_days: 90 });
    const item = data.expiring.find((x) => x.supply_id === 3);
    assert.equal(item, undefined, '今天+91 超出提醒窗口，不应被标记为即将过期/已过期');
  });

  test('到期日=今天-1 → 出现在 expiring，days_to_expiry=-1（已过期）', async () => {
    const data = await getAlertsWith([makeSupply(4, { expiry_date: addDays(today, -1) })], { expiry_alert_days: 90 });
    const item = data.expiring.find((x) => x.supply_id === 4);
    assert.ok(item, '昨天到期用品应进入 expiring 列表（已过期）');
    assert.equal(item.days_to_expiry, -1, 'days_to_expiry 应为 -1（已过期），源码若给 +1 即符号反了');
  });

  test('expiry_alert_days=30：到期日=今天+20 → 出现在 expiring，days_to_expiry=+20', async () => {
    const data = await getAlertsWith([makeSupply(5, { expiry_date: addDays(today, 20) })], { expiry_alert_days: 30 });
    const item = data.expiring.find((x) => x.supply_id === 5);
    assert.ok(item, '今天+20（窗口30内）应进入 expiring');
    assert.equal(item.days_to_expiry, 20, 'days_to_expiry 应为 +20（到期日-今天）');
  });

  test('expiry_alert_days=30：到期日=今天+60 → 不应出现在 expiring', async () => {
    const data = await getAlertsWith([makeSupply(6, { expiry_date: addDays(today, 60) })], { expiry_alert_days: 30 });
    const item = data.expiring.find((x) => x.supply_id === 6);
    assert.equal(item, undefined, '今天+60 超出窗口30，不应被标记为即将过期/已过期');
  });

  test('默认设置缺失时 expiry_alert_days 回退为 90，今天+90 仍 expiring_soon', async () => {
    const data = await getAlertsWith([makeSupply(7, { expiry_date: addDays(today, 90) })], {});
    assert.equal(data.expiry_alert_days, 90, 'settings 缺省应回退 90');
    const item = data.expiring.find((x) => x.supply_id === 7);
    assert.ok(item, '缺省90窗口下今天+90 应进入 expiring');
    assert.equal(item.days_to_expiry, 90, 'days_to_expiry 应为 +90');
  });

  // ---------------- 定期检查（check_due） ----------------
  test('定期检查：last_check_date 为空 → 进入 check_due，next_check_date=null', async () => {
    const data = await getAlertsWith([makeSupply(11, { last_check_date: null, check_cycle_days: 90 })], { expiry_alert_days: 90 });
    const item = data.check_due.find((x) => x.supply_id === 11);
    assert.ok(item, '从未检查用品应进入 check_due');
    assert.equal(item.next_check_date, null);
  });

  test('定期检查：last_check=今天-周期 → 进入 check_due，next_check_date=今天', async () => {
    const cycle = 90;
    const data = await getAlertsWith(
      [makeSupply(12, { last_check_date: addDays(today, -cycle), check_cycle_days: cycle })],
      { expiry_alert_days: 90 }
    );
    const item = data.check_due.find((x) => x.supply_id === 12);
    assert.ok(item, '上次检查正好是一个周期前 → 今天应检');
    assert.equal(item.next_check_date, today);
  });

  test('定期检查：last_check=今天 → 不进入 check_due', async () => {
    const data = await getAlertsWith([makeSupply(13, { last_check_date: today, check_cycle_days: 90 })], { expiry_alert_days: 90 });
    const item = data.check_due.find((x) => x.supply_id === 13);
    assert.equal(item, undefined, '今天刚检查过，未到下次检查日，不应进入 check_due');
  });
});
