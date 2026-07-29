// 手机号免密登录改造 —— 后端集成测试（QA：严过关 Yan）
// 免费方案：Node 22 内置 fetch + 内存 express 起服务；不引入 supertest 等新依赖。
//
// 覆盖：
//  a. 成功：真实 active 且 phone 唯一 → 200 + access_token + user
//  b. 400 缺标识：POST {} / {username:''} → 400
//  c. 401 不存在：POST 不存在的手机号 → 401
//  d. 403 禁用：is_active=false → 403（动态改 db.json，测完还原）
//  e. 403 同手机号多账户：重复 phone → 403（动态改 db.json，测完还原）
//  f. 限流配置：loginLimiter windowMs=5min 且 max=20（源码静态断言）
//
// db.json 安全：任何临时修改前先 copyFileSync 备份；
//   用例内 finally 还原改动字段；进程退出兜底 restoreDB() 终极还原，绝不残留脏数据。
//
// 运行：node backend/tests/phone-login.test.mjs

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(__dirname, '..', 'db.json');
const BACKUP = DB_PATH + '.qa-bak';
const AUTH_SRC = path.join(__dirname, '..', 'routes', 'auth.js');

// ---- 加载被测模块（受控捕获，给出明确 FAIL 而非硬崩溃） ----
let authRouter = null;
let loadError = null;
try {
  authRouter = require('../routes/auth.js');
} catch (e) {
  loadError = e;
}

// ---- 内存 Express 服务 ----
let server = null;
let base = '';
if (authRouter) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  server = app.listen(0);
  base = 'http://127.0.0.1:' + server.address().port;
}

// ---- db.json 备份 / 还原工具 ----
function backupDB() {
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(DB_PATH, BACKUP);
}
function restoreDB() {
  if (fs.existsSync(BACKUP)) {
    try { fs.copyFileSync(BACKUP, DB_PATH); } catch {}
    try { fs.unlinkSync(BACKUP); } catch {}
  }
}
function readDBRaw() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDBRaw(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// 进程退出兜底：即使异常退出也确保 db.json 完全还原
process.on('exit', () => { try { restoreDB(); } catch {} });

// ---- 请求工具 ----
async function POST(payload) {
  const res = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: res.status, body };
}

// ---- 极简测试框架 ----
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const REAL_PHONE = '13800138000';   // db.json 中真实存在、active、phone 唯一
const FAKE_PHONE = '13900000000';   // db.json 中不存在的手机号

test('模块加载：require auth.js 不抛错（依赖可加载、无语法错误）', () => {
  assert.equal(loadError, null, 'auth.js 加载失败: ' + (loadError && loadError.message));
  assert.ok(authRouter, 'router 不应为空');
  assert.equal(typeof authRouter, 'function', '应为 Express Router 函数');
});

test('a. 成功：真实 active 且 phone 唯一 → 200 + access_token + user', async () => {
  assert.ok(base, 'server 未就绪');
  const res = await POST({ phone: REAL_PHONE });
  assert.equal(res.status, 200, '应返回 200，实际 ' + res.status + ' body=' + JSON.stringify(res.body));
  assert.ok(
    typeof res.body.access_token === 'string' && res.body.access_token.length > 0,
    'access_token 应为非空字符串'
  );
  assert.ok(res.body.user && typeof res.body.user === 'object', '应返回 user 对象');
});

test('a. 成功登录响应不含 password 字段（防泄露）', async () => {
  const res = await POST({ phone: REAL_PHONE });
  assert.equal(res.status, 200);
  assert.ok(!('password' in res.body.user), 'user 对象不应包含 password 字段');
});

test('b. 400 缺标识：POST {} → 400「请填写手机号」', async () => {
  const res = await POST({});
  assert.equal(res.status, 400, '实际 ' + res.status);
  assert.equal(res.body.message, '请填写手机号');
});

test('b. 400 缺标识：POST {username:\'\'} → 400「请填写手机号」', async () => {
  const res = await POST({ username: '' });
  assert.equal(res.status, 400, '实际 ' + res.status);
  assert.equal(res.body.message, '请填写手机号');
});

test('c. 401 不存在：POST {phone:FAKE} → 401「用户名或手机号错误」', async () => {
  const res = await POST({ phone: FAKE_PHONE });
  assert.equal(res.status, 401, '实际 ' + res.status);
  assert.equal(res.body.message, '用户名或手机号错误');
});

test('d. 403 禁用：is_active=false → 403「用户已被禁用」', () => {
  backupDB();
  const db = readDBRaw();
  const u = db.users.find(x => x.phone === REAL_PHONE);
  assert.ok(u, '测试用手机号用户应存在于 db.json');
  const prev = u.is_active;
  u.is_active = false;
  writeDBRaw(db);
  return (async () => {
    const res = await POST({ phone: REAL_PHONE });
    assert.equal(res.status, 403, '实际 ' + res.status + ' body=' + JSON.stringify(res.body));
    assert.equal(res.body.message, '用户已被禁用');
  })().finally(() => {
    // 用例内即时还原，避免影响后续用例
    const db2 = readDBRaw();
    const u2 = db2.users.find(x => x.phone === REAL_PHONE);
    if (u2) u2.is_active = prev;
    writeDBRaw(db2);
  });
});

test('e. 403 同手机号多账户：重复 phone → 403「该手机号关联多个账户」', () => {
  backupDB();
  const db = readDBRaw();
  const src = db.users.find(x => x.phone === REAL_PHONE);
  const dup = JSON.parse(JSON.stringify(src));
  dup.user_id = 99999;
  dup.username = 'dup_qa_13800138000';
  db.users.push(dup);
  writeDBRaw(db);
  return (async () => {
    const res = await POST({ phone: REAL_PHONE });
    assert.equal(res.status, 403, '实际 ' + res.status + ' body=' + JSON.stringify(res.body));
    assert.equal(res.body.message, '该手机号关联多个账户，请联系管理员');
  })().finally(() => {
    // 移除追加的重复用户，即时还原
    const db2 = readDBRaw();
    db2.users = db2.users.filter(x => x.user_id !== 99999 && x.username !== 'dup_qa_13800138000');
    writeDBRaw(db2);
  });
});

test('f. 限流配置：loginLimiter windowMs=5min 且 max=20（源码断言）', () => {
  const src = fs.readFileSync(AUTH_SRC, 'utf8');
  assert.ok(/windowMs:\s*5\s*\*\s*60\s*\*\s*1000/.test(src), '应配置 windowMs: 5 * 60 * 1000（5 分钟）');
  assert.ok(/max:\s*20/.test(src), '应配置 max: 20（5 分钟 20 次）');
});

// ---- 运行 ----
let passed = 0;
let failed = 0;
const failures = [];

console.log('\n手机号免密登录改造 —— 后端集成测试开始\n');

(async () => {
  try {
    for (const t of tests) {
      try {
        await t.fn();
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
    } else {
      console.log('ALL PASS ✅');
    }
  } finally {
    if (server) { try { server.close(); } catch {} }
    restoreDB(); // 终极兜底：确保 db.json 完全还原为原始内容
  }
  process.exit(failed > 0 ? 1 : 0);
})();
