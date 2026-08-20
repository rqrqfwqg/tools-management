// 回归测试：/auth/login 微信绑定「一一对应」约束
// 覆盖：①首次绑定成功 bound_openid=true ②openid 已被其他账号占用 → 409 ③无 wx_code 正常登录
// 运行：cd backend && JWT_SECRET=testsecret123 node --test tests/login-wxbind.test.mjs
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import https from 'node:https';
import express from 'express';

// 隔离 DB
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxbind-'));
process.env.DB_PATH = path.join(tmpDir, 'db.json');
process.env.JWT_SECRET = 'testsecret123';
process.env.WX_APPID = 'mock_appid';
process.env.WX_SECRET = 'mock_secret';

// Mock 微信 jscode2session：固定返回 openid
const MOCK_OPENID = 'openid_test_001';
https.get = ((url, cb) => {
  const body = JSON.stringify({ openid: MOCK_OPENID, session_key: 'sk_test' });
  const res = new Readable();
  res.push(body);
  res.push(null);
  cb(res);
  return { on() { return this; }, setTimeout() { return this; }, destroy() {} };
});

const { initDB, readDB, writeDB, nextId } = await import('../routes/db.js');
const authRouter = (await import('../routes/auth.js')).default;

let server;
let base;

before(async () => {
  initDB();
  // 追加一个无 wx_openid 的普通用户 staff
  const db = readDB();
  db.users.push({
    user_id: nextId(db.users, 'user_id'),
    username: 'staff1',
    real_name: '员工一',
    phone: '13900000001',
    role: 'staff',
    role_id: 3,
    role_name: '员工',
    is_active: true,
    password: '$2a$10$abcdefghijklmnopqrstuv' // 占位（本接口不校验密码）
  });
  writeDB(db);

  const app = express();
  app.use(express.json());
  app.use('/api', authRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const login = (body) =>
  fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

test('① 无 wx_code：手机号/用户名免密登录签发 token', async () => {
  const res = await login({ identifier: 'admin' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.access_token);
  assert.equal(data.bound_openid, false);
});

test('② 首次绑定：wx_code → openid 绑定到账号，bound_openid=true', async () => {
  const res = await login({ identifier: 'admin', wx_code: 'mock-code-1' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.bound_openid, true, '应完成绑定');
  const db = readDB();
  const admin = db.users.find((u) => u.username === 'admin');
  assert.equal(admin.wx_openid, MOCK_OPENID, 'admin 应绑定 mock openid');
});

test('③ 一一对应：同一 openid 已被 admin 绑定，staff 绑定应 409 拒绝', async () => {
  const res = await login({ identifier: 'staff1', wx_code: 'mock-code-2' });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.message || '', /已绑定系统账号/);
  const db = readDB();
  const staff = db.users.find((u) => u.username === 'staff1');
  assert.equal(staff.wx_openid, undefined, 'staff 不应被写入 openid');
});

test('④ 已绑定账号再次登录：不再重复写库，bound_openid=false', async () => {
  const res = await login({ identifier: 'admin', wx_code: 'mock-code-3' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.bound_openid, false, '已绑定过，不应重复绑定');
});

test('⑤ 空 identifier：400；不存在的账号：401', async () => {
  assert.equal((await login({})).status, 400);
  assert.equal((await login({ identifier: 'no-such-user-xyz' })).status, 401);
});
