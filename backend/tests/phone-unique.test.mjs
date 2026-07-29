// backend/tests/phone-unique.test.mjs
// 集成测试：手机号唯一校验（POST /users、PUT /users/:id）
// 约束：不引入新依赖（仅 Node 22 内置 fetch + assert + 内存 express）
// 安全：测试前备份 db.json，所有用例跑完后（finally）还原，确保零残留
//
// 说明：users.js 在路由定义处内联了 authenticate/requireAdmin 中间件，
// 直接挂载路由会触发 401。本测试在 require 缓存中将 ../middleware/auth 替换为
// 透传 stub（仅作用于内存测试实例，不改动任何源码），从而让请求直达校验逻辑。

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import assert from 'assert';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- db.json 备份（关键：零残留） ----------
const DB_PATH = path.join(__dirname, '..', 'db.json');
const DB_BACKUP = DB_PATH + '.qa.bak';
fs.copyFileSync(DB_PATH, DB_BACKUP);

// ---------- 绕过鉴权中间件（仅测试内存实例，不改源码） ----------
const authPath = require.resolve('../middleware/auth');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    authenticate: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next(),
    requireApprover: (req, res, next) => next(),
    requireMaterialManager: (req, res, next) => next(),
    JWT_SECRET: 'qa-test-secret'
  }
};

// ---------- 装配内存 express 服务 ----------
const express = require('express');
const usersRouter = require('../routes/users.js');

const app = express();
app.use(express.json());
app.use('/api', usersRouter);

const server = app.listen(0);
const base = 'http://127.0.0.1:' + server.address().port;

// ---------- 测试工具 ----------
let pass = 0;
let fail = 0;
const failures = [];

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      pass++;
      console.log(`  PASS  ${name}`);
    })
    .catch((err) => {
      fail++;
      failures.push({ name, err });
      console.log(`  FAIL  ${name}`);
      console.log(`        ${err.message}`);
    });
}

async function postUser(body) {
  const res = await fetch(base + '/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { status: res.status, json, text };
}

async function putUser(id, body) {
  const res = await fetch(base + '/api/users/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { status: res.status, json, text };
}

function assertPhoneMsg(json) {
  assert.ok(json && typeof json === 'object', '响应体应为 JSON 对象');
  assert.ok(
    json.message && json.message.includes('手机号已存在'),
    `期望 message 含「手机号已存在」，实际: ${JSON.stringify(json)}`
  );
}

// ---------- 读取 db.json 现有数据，提取手机号与有效 dept_id ----------
const dbRaw = fs.readFileSync(DB_PATH, 'utf8');
const dbData = JSON.parse(dbRaw);
const usersWithPhone = dbData.users.filter((u) => u.phone && String(u.phone).trim());
assert.ok(usersWithPhone.length >= 2, 'db.json 需至少包含 2 个非空手机号用户用于重复校验');

const P = usersWithPhone[0].phone;          // 已存在手机号（重复校验用）
const userA = usersWithPhone[0];            // A：user_id + phone
const userB = usersWithPhone[1];            // B：另一用户，phone 与 A 不同
const validDeptId = dbData.departments[0].dept_id;

// ---------- 用例 ----------
async function run() {
  // a. POST 重复手机号 -> 400（只读，不写库）
  await record('a. POST 重复手机号 → 400', async () => {
    const r = await postUser({
      username: '__qatest__dup',
      real_name: 'QA',
      dept_id: validDeptId,
      role: 'staff',
      phone: P
    });
    assert.strictEqual(r.status, 400, `期望 400，实际 ${r.status}: ${r.text}`);
    assertPhoneMsg(r.json);
  });

  // b. POST 不传手机号 → 成功（不报手机号重复）
  await record('b. POST 不传手机号 → 成功', async () => {
    const r = await postUser({
      username: '__qatest__nophone',
      real_name: 'QA',
      dept_id: validDeptId,
      role: 'staff'
      // 故意不传 phone
    });
    assert.ok(r.status >= 200 && r.status < 300, `期望 2xx，实际 ${r.status}: ${r.text}`);
    assert.ok(r.json && r.json.user_id, '创建成功应返回带 user_id 的用户对象');
  });

  // c. POST 新唯一手机号 → 成功
  await record('c. POST 新唯一手机号 → 成功', async () => {
    const newPhone = '13900000000'; // db 中不存在
    const r = await postUser({
      username: '__qatest__newphone',
      real_name: 'QA',
      dept_id: validDeptId,
      role: 'staff',
      phone: newPhone
    });
    assert.ok(r.status >= 200 && r.status < 300, `期望 2xx，实际 ${r.status}: ${r.text}`);
    assert.ok(
      r.json && r.json.phone === newPhone,
      `返回 phone 应为 ${newPhone}，实际 ${r.json && r.json.phone}`
    );
  });

  // d. PUT 改同他人手机号 → 400（含自身排除验证）
  await record('d1. PUT 改他人手机号(A→B) → 400', async () => {
    const r = await putUser(userA.user_id, { phone: userB.phone });
    assert.strictEqual(r.status, 400, `期望 400，实际 ${r.status}: ${r.text}`);
    assertPhoneMsg(r.json);
  });

  await record('d2. PUT 改自身手机号(A→A) → 成功（验证排除自身）', async () => {
    const r = await putUser(userA.user_id, { phone: userA.phone });
    assert.ok(r.status >= 200 && r.status < 300, `期望 2xx，实际 ${r.status}: ${r.text}`);
    assert.ok(r.json && r.json.user_id === userA.user_id, '应返回同一用户');
  });
}

// ---------- 主流程：try/finally 确保 db.json 还原 ----------
run()
  .then(() => {
    console.log(`\n==== 测试结果：PASS=${pass}  FAIL=${fail} ====`);
    if (fail > 0) {
      console.log('失败用例：');
      for (const f of failures) console.log(`  - ${f.name}: ${f.err.message}`);
    }
  })
  .catch((e) => {
    console.error('测试运行异常:', e);
    fail++;
  })
  .finally(() => {
    // 关键：无论成功失败，均还原 db.json 并关闭服务
    try {
      fs.copyFileSync(DB_BACKUP, DB_PATH);
    } catch (e) {
      console.error('还原 db.json 失败:', e.message);
    }
    try {
      fs.unlinkSync(DB_BACKUP);
    } catch { /* ignore */ }
    server.close();
    console.log('db.json 已还原（零残留）。测试服务已关闭。');
    process.exit(fail > 0 ? 1 : 0);
  });
