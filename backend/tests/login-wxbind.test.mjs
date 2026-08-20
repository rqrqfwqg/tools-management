// 回归测试：/auth/login 微信绑定（wx_code）逻辑
// 运行：cd backend && JWT_SECRET=testsecret123 node --test tests/login-wxbind.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// 隔离 DB：临时文件，不碰生产 db.json
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxbind-'));
process.env.DB_PATH = path.join(tmpDir, 'db.json');
process.env.JWT_SECRET = 'testsecret123';
// 模拟未配置微信凭证（绑定逻辑应静默跳过，不阻断登录）
delete process.env.WX_APPID;
delete process.env.WX_SECRET;

const { initDB } = await import('../routes/db.js');
const authRouter = (await import('../routes/auth.js')).default;

let server;
let base;

before(async () => {
  initDB(); // 创建 admin 等初始用户（DEFAULT_ADMIN_PASSWORD 或默认）
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

test('无 wx_code：手机号/用户名免密登录签发 token', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.access_token, '应有 access_token');
  assert.equal(data.user.username, 'admin');
  assert.equal(data.bound_openid, false);
});

test('带 wx_code 但微信凭证未配置：静默跳过绑定，登录不受阻断', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', wx_code: 'dummy-code' })
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.access_token, '应正常登录');
  assert.equal(data.bound_openid, false, '未配置凭证不应绑定');

  // db 中 admin.wx_openid 应保持未绑定
  const db = JSON.parse(fs.readFileSync(process.env.DB_PATH, 'utf8'));
  const admin = db.users.find((u) => u.username === 'admin');
  assert.equal(admin.wx_openid, undefined, '未配置凭证时不应写入 wx_openid');
});

test('空 identifier：400 参数校验', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
});

test('不存在的账号：401', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'no-such-user-xyz' })
  });
  assert.equal(res.status, 401);
});
