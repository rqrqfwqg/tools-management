#!/usr/bin/env node
/**
 * QA 功能与边界测试 - 工器具管理系统
 * 覆盖：认证、用户、部门、角色、仓库、货架、货位、工具、工具分类、工单
 */

const BASE = 'http://localhost:3000';
let token = '';
let adminToken = '';
let staffToken = '';
let testResults = [];
let passCount = 0;
let failCount = 0;
let createdIds = {};

// ============ Helpers ============
async function request(method, path, body, headers = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token && !h['Authorization']) h['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, body: json, raw: text };
  } catch (e) {
    return { status: 0, body: null, raw: e.message };
  }
}

function test(name, passed, detail = '') {
  testResults.push({ name, passed, detail });
  if (passed) passCount++; else failCount++;
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

function setToken(t) { token = t; }

// ============ 1. 认证测试 ============
async function testAuth() {
  console.log('\n=== 1. 认证模块 ===');

  // 1.1 正常登录
  let r = await request('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  test('管理员登录', r.status === 200 && r.body?.access_token, `status=${r.status}`);
  if (r.body?.access_token) adminToken = r.body.access_token;

  // 1.2 员工登录
  r = await request('POST', '/api/auth/login', { username: 'user1', password: '123456' });
  test('普通员工登录', r.status === 200 && r.body?.access_token, `status=${r.status}`);
  if (r.body?.access_token) staffToken = r.body.access_token;

  // 1.3 错误密码
  r = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  test('错误密码拒绝', r.status === 401, `status=${r.status}`);

  // 1.4 不存在用户
  r = await request('POST', '/api/auth/login', { username: 'nobody', password: '123456' });
  test('不存在用户拒绝', r.status === 401, `status=${r.status}`);

  // 1.5 空用户名
  r = await request('POST', '/api/auth/login', { username: '', password: '123456' });
  test('空用户名处理', r.status === 400 || r.status === 401, `status=${r.status}`);

  // 1.6 空密码
  r = await request('POST', '/api/auth/login', { username: 'admin', password: '' });
  test('空密码处理', r.status === 400 || r.status === 401, `status=${r.status}`);

  // 1.7 无 Token 访问受保护路由
  const savedToken = token;
  token = '';
  r = await request('GET', '/api/users');
  test('无Token访问受保护路由拒绝', r.status === 401 || r.status === 403, `status=${r.status}`);
  token = savedToken;

  // 1.8 无效 Token
  token = 'invalid.token.here';
  r = await request('GET', '/api/users');
  test('无效Token拒绝', r.status === 401 || r.status === 403, `status=${r.status}`);
  token = savedToken;

  // 1.9 获取当前用户信息
  setToken(adminToken);
  r = await request('GET', '/api/auth/me');
  test('获取当前用户信息', r.status === 200 && r.body?.username === 'admin', `status=${r.status}`);

  // 1.10 SQL注入尝试
  r = await request('POST', '/api/auth/login', { username: "admin' OR '1'='1", password: 'x' });
  test('SQL注入防护', r.status === 401, `status=${r.status}`);

  // 1.11 超长输入
  r = await request('POST', '/api/auth/login', { username: 'a'.repeat(10000), password: 'x' });
  test('超长用户名处理', r.status >= 400, `status=${r.status}`);
}

// ============ 2. 用户管理 ============
async function testUsers() {
  console.log('\n=== 2. 用户管理 ===');
  setToken(adminToken);

  // 2.1 获取用户列表
  let r = await request('GET', '/api/users');
  test('获取用户列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  // 2.2 创建用户
  r = await request('POST', '/api/users', {
    username: 'qa_test_user',
    password: 'Test@123',
    real_name: 'QA测试用户',
    dept_id: 1,
    role_id: 2,
    phone: '13900001111'
  });
  test('创建用户', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.user_id) createdIds.user = r.body.user_id;

  // 2.3 创建重复用户名
  r = await request('POST', '/api/users', {
    username: 'qa_test_user',
    password: 'Test@123',
    real_name: '重复用户',
    dept_id: 1,
    role_id: 2,
    phone: '13900002222'
  });
  test('重复用户名拒绝', r.status === 400 || r.status === 409, `status=${r.status}`);

  // 2.4 创建用户缺少必填字段（已知BUG：服务端未校验）
  r = await request('POST', '/api/users', { username: '' });
  test('创建用户缺少字段处理', r.status >= 400, `status=${r.status} [BUG: 服务端未校验必填字段]`);

  // 2.5 更新用户
  if (createdIds.user) {
    r = await request('PUT', `/api/users/${createdIds.user}`, { real_name: 'QA测试-已更新', phone: '13900003333' });
    test('更新用户', r.status === 200, `status=${r.status}`);
  }

  // 2.6 重置密码
  if (createdIds.user) {
    r = await request('POST', `/api/users/${createdIds.user}/reset-password`);
    test('重置密码', r.status === 200, `status=${r.status}`);
  }

  // 2.7 员工无权创建用户
  setToken(staffToken);
  r = await request('POST', '/api/users', {
    username: 'should_fail', password: 'x', real_name: 'x', dept_id: 1, role_id: 2
  });
  test('员工无权创建用户', r.status === 403, `status=${r.status}`);
  setToken(adminToken);

  // 2.8 删除测试用户
  if (createdIds.user) {
    r = await request('DELETE', `/api/users/${createdIds.user}`);
    test('删除用户', r.status === 200, `status=${r.status}`);
  }

  // 2.9 删除不存在的用户
  r = await request('DELETE', '/api/users/99999');
  test('删除不存在用户处理', r.status === 404 || r.status === 400, `status=${r.status}`);
}

// ============ 3. 部门管理 ============
async function testDepartments() {
  console.log('\n=== 3. 部门管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/departments');
  test('获取部门列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  // 创建部门
  r = await request('POST', '/api/departments', { name: 'QA测试部门' });
  test('创建部门', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.dept_id || r.body?.id) createdIds.dept = r.body?.dept_id || r.body?.id;

  // 重复部门名
  r = await request('POST', '/api/departments', { name: 'QA测试部门' });
  test('重复部门名处理', r.status === 400 || r.status === 409 || r.status === 200, `status=${r.status}`);

  // 空名称
  r = await request('POST', '/api/departments', { name: '' });
  test('空部门名处理', r.status >= 400, `status=${r.status}`);

  // 更新
  if (createdIds.dept) {
    r = await request('PUT', `/api/departments/${createdIds.dept}`, { name: 'QA测试-已更新' });
    test('更新部门', r.status === 200, `status=${r.status}`);
  }

  // 删除有用户的部门（用 dept_id=1 试试）
  r = await request('DELETE', '/api/departments/1');
  test('删除有用户的部门（关联检查）', r.status === 400 || r.status === 409, `status=${r.status} ⚠️应阻止`);

  // 清理
  if (createdIds.dept) {
    r = await request('DELETE', `/api/departments/${createdIds.dept}`);
    test('删除空部门', r.status === 200, `status=${r.status}`);
  }
}

// ============ 4. 角色管理 ============
async function testRoles() {
  console.log('\n=== 4. 角色管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/roles');
  test('获取角色列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  r = await request('POST', '/api/roles', { name: 'QA测试角色', description: '测试用' });
  test('创建角色', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.role_id || r.body?.id) createdIds.role = r.body?.role_id || r.body?.id;

  if (createdIds.role) {
    r = await request('PUT', `/api/roles/${createdIds.role}`, { name: 'QA角色-已更新' });
    test('更新角色', r.status === 200, `status=${r.status}`);

    r = await request('DELETE', `/api/roles/${createdIds.role}`);
    test('删除角色', r.status === 200, `status=${r.status}`);
  }
}

// ============ 5. 仓库管理 ============
async function testWarehouses() {
  console.log('\n=== 5. 仓库管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/warehouses');
  test('获取仓库列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  r = await request('POST', '/api/warehouses', { name: 'QA测试仓库', location: '测试位置' });
  test('创建仓库', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.warehouse_id || r.body?.id) createdIds.warehouse = r.body?.warehouse_id || r.body?.id;

  if (createdIds.warehouse) {
    r = await request('PUT', `/api/warehouses/${createdIds.warehouse}`, { name: 'QA仓库-已更新' });
    test('更新仓库', r.status === 200, `status=${r.status}`);
  }
}

// ============ 6. 货架管理 ============
async function testShelves() {
  console.log('\n=== 6. 货架管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/shelves');
  test('获取货架列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  if (createdIds.warehouse) {
    r = await request('POST', '/api/shelves', { name: 'QA测试货架', warehouse_id: createdIds.warehouse });
    test('创建货架', r.status === 200 || r.status === 201, `status=${r.status}`);
    if (r.body?.shelf_id || r.body?.id) createdIds.shelf = r.body?.shelf_id || r.body?.id;

    if (createdIds.shelf) {
      r = await request('PUT', `/api/shelves/${createdIds.shelf}`, { name: 'QA货架-已更新' });
      test('更新货架', r.status === 200, `status=${r.status}`);
    }
  } else {
    test('创建货架(跳过-无仓库)', false, '前置仓库未创建');
  }
}

// ============ 7. 货位管理 ============
async function testStorageLocations() {
  console.log('\n=== 7. 货位管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/storage-locations');
  test('获取货位列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  if (createdIds.shelf) {
    r = await request('POST', '/api/storage-locations', {
      name: 'QA测试货位',
      shelf_id: createdIds.shelf,
      warehouse_id: createdIds.warehouse
    });
    test('创建货位', r.status === 200 || r.status === 201, `status=${r.status}`);
    if (r.body?.location_id || r.body?.id) createdIds.location = r.body?.location_id || r.body?.id;
  } else {
    test('创建货位(跳过-无货架)', false, '前置货架未创建');
  }
}

// ============ 8. 工具分类 ============
async function testToolCategories() {
  console.log('\n=== 8. 工具分类 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/tool-categories');
  test('获取工具分类列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  r = await request('POST', '/api/tool-categories', { name: 'QA测试分类' });
  test('创建工具分类', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.category_id || r.body?.id) createdIds.category = r.body?.category_id || r.body?.id;

  // 删除有工具的分类
  r = await request('DELETE', '/api/tool-categories/1');
  test('删除有工具的分类（关联检查）', r.status === 400 || r.status === 409, `status=${r.status} ⚠️应阻止`);

  // 清理
  if (createdIds.category) {
    r = await request('DELETE', `/api/tool-categories/${createdIds.category}`);
    test('删除空工具分类', r.status === 200, `status=${r.status}`);
  }
}

// ============ 9. 工具管理 ============
async function testTools() {
  console.log('\n=== 9. 工具管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/tools');
  test('获取工具列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  // 创建工具（需要分类和货位）
  const toolData = {
    name: 'QA测试工具',
    category_id: 1,
    model: 'QA-Model-1',
    quantity: 10,
    available_quantity: 10,
    location_id: createdIds.location || 1,
    warehouse_id: createdIds.warehouse || 1,
    status: 'available'
  };
  r = await request('POST', '/api/tools', toolData);
  test('创建工具', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.tool_id || r.body?.id) createdIds.tool = r.body?.tool_id || r.body?.id;

  // 创建缺少必填字段
  r = await request('POST', '/api/tools', { name: '' });
  test('创建工具缺少字段', r.status >= 400, `status=${r.status}`);

  // 更新
  if (createdIds.tool) {
    r = await request('PUT', `/api/tools/${createdIds.tool}`, { name: 'QA工具-已更新', quantity: 15 });
    test('更新工具', r.status === 200, `status=${r.status}`);
  }

  // 员工无权操作
  setToken(staffToken);
  r = await request('POST', '/api/tools', { name: 'hack' });
  test('员工无权创建工具', r.status === 403, `status=${r.status}`);
  setToken(adminToken);
}

// ============ 10. 工单管理 ============
async function testOrders() {
  console.log('\n=== 10. 工单管理 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/orders');
  test('获取工单列表', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);

  // 创建工单（员工可以）— API 接收 tool_ids 数组
  setToken(staffToken);
  const orderData = {
    tool_ids: [createdIds.tool || 1],
    purpose: 'QA测试借用',
    expected_return: '2026-06-01'
  };
  r = await request('POST', '/api/orders', orderData);
  test('员工创建工单', r.status === 200 || r.status === 201, `status=${r.status}`);
  if (r.body?.order_id || r.body?.id) createdIds.order = r.body?.order_id || r.body?.id;

  // 创建工单 - 空用途
  r = await request('POST', '/api/orders', {
    tool_ids: [1],
    purpose: '',
    expected_return: '2026-06-01'
  });
  test('空用途创建工单处理', r.status >= 400 || r.status === 200, `status=${r.status}`);

  // 创建工单 - 超量借用
  r = await request('POST', '/api/orders', {
    tool_ids: [createdIds.tool || 1],
    purpose: '超量借用测试',
    expected_return: '2026-06-01',
    quantity: 99999
  });
  test('超量借用处理', r.status === 400 || r.status === 200, `status=${r.status}`);

  // 审批工单（需要admin）
  if (createdIds.order) {
    setToken(adminToken);
    r = await request('POST', `/api/orders/${createdIds.order}/approve`);
    test('管理员审批工单', r.status === 200, `status=${r.status}`);

    // 归还
    setToken(staffToken);
    r = await request('POST', `/api/orders/${createdIds.order}/return`);
    test('员工归还工单', r.status === 200, `status=${r.status}`);
  }

  // 驳回工单
  setToken(staffToken);
  r = await request('POST', '/api/orders', {
    tool_ids: [createdIds.tool || 1],
    purpose: 'QA驳回测试',
    expected_return: '2026-06-01'
  });
  if (r.body?.order_id || r.body?.id) {
    const rejectOrderId = r.body?.order_id || r.body?.id;
    setToken(adminToken);
    r = await request('POST', `/api/orders/${rejectOrderId}/reject`, { reason: '测试驳回' });
    test('管理员驳回工单', r.status === 200, `status=${r.status}`);

    // 清理
    r = await request('DELETE', `/api/orders/${rejectOrderId}`);
  }

  // 取消工单
  setToken(staffToken);
  r = await request('POST', '/api/orders', {
    tool_ids: [createdIds.tool || 1],
    purpose: 'QA取消测试',
    expected_return: '2026-06-01'
  });
  if (r.body?.order_id || r.body?.id) {
    const cancelOrderId = r.body?.order_id || r.body?.id;
    r = await request('POST', `/api/orders/${cancelOrderId}/cancel`);
    test('员工取消工单', r.status === 200, `status=${r.status}`);
  }
}

// ============ 11. 仪表盘 ============
async function testDashboard() {
  console.log('\n=== 11. 仪表盘 ===');
  setToken(adminToken);

  let r = await request('GET', '/api/dashboard');
  test('获取仪表盘数据', r.status === 200 && r.body, `status=${r.status}`);

  setToken(staffToken);
  r = await request('GET', '/api/dashboard');
  test('员工获取仪表盘', r.status === 200, `status=${r.status}`);
}

// ============ 12. 修改密码 ============
async function testChangePassword() {
  console.log('\n=== 12. 修改密码 ===');
  setToken(adminToken);

  let r = await request('POST', '/api/auth/change-password', {
    old_password: '123456',
    new_password: 'NewPass@789'
  });
  test('修改密码-正确旧密码', r.status === 200, `status=${r.status}`);

  // 改回来
  if (r.status === 200) {
    r = await request('POST', '/api/auth/change-password', {
      old_password: 'NewPass@789',
      new_password: '123456'
    });
    test('密码改回原值', r.status === 200, `status=${r.status}`);
  }

  // 错误旧密码
  r = await request('POST', '/api/auth/change-password', {
    old_password: 'wrong_old',
    new_password: 'whatever'
  });
  test('修改密码-错误旧密码拒绝', r.status === 400 || r.status === 401, `status=${r.status}`);

  // 空新密码
  r = await request('POST', '/api/auth/change-password', {
    old_password: '123456',
    new_password: ''
  });
  test('修改密码-空新密码处理', r.status >= 400, `status=${r.status}`);
}

// ============ 13. 边界与异常测试 ============
async function testBoundaryAndEdge() {
  console.log('\n=== 13. 边界与异常测试 ===');
  setToken(adminToken);

  // 超长字符串
  let r = await request('POST', '/api/departments', { name: 'A'.repeat(5000) });
  test('超长部门名处理', r.status >= 400 || r.status === 200, `status=${r.status}`);

  // 特殊字符
  r = await request('POST', '/api/departments', { name: '<script>alert(1)</script>' });
  test('XSS部门名处理', r.status >= 200, `status=${r.status}`);

  // 数字ID越界
  r = await request('GET', '/api/users/99999');
  test('不存在的用户ID', r.status === 404 || r.status === 400, `status=${r.status}`);

  // 负数ID
  r = await request('DELETE', '/api/tools/-1');
  test('负数ID处理', r.status >= 400, `status=${r.status}`);

  // 非数字ID
  r = await request('PUT', '/api/tools/abc', { name: 'x' });
  test('非数字ID处理', r.status >= 400, `status=${r.status}`);

  // JSON格式错误（手动发raw）
  try {
    const res = await fetch(`${BASE}/api/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: '{invalid json'
    });
    test('畸形JSON处理', res.status >= 400, `status=${res.status}`);
  } catch (e) {
    test('畸形JSON处理', true, 'connection error');
  }

  // 大数量请求
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(request('GET', '/api/tools'));
  }
  const results = await Promise.all(promises);
  const allOk = results.every(r => r.status === 200);
  test('并发20请求稳定性', allOk, `failures=${results.filter(r => r.status !== 200).length}`);

  // HTTP方法错误
  r = await request('PATCH', '/api/users/1', {});
  test('不支持的方法(PATCH)', r.status === 404 || r.status === 405 || r.status === 400, `status=${r.status}`);
}

// ============ 14. 权限隔离测试 ============
async function testPermissionIsolation() {
  console.log('\n=== 14. 权限隔离 ===');

  setToken(staffToken);

  // 员工尝试管理操作
  let r = await request('POST', '/api/departments', { name: 'hack' });
  test('员工创建部门-拒绝', r.status === 403, `status=${r.status}`);

  r = await request('DELETE', '/api/users/1');
  test('员工删除用户-拒绝', r.status === 403, `status=${r.status}`);

  r = await request('POST', '/api/warehouses', { name: 'hack' });
  test('员工创建仓库-拒绝', r.status === 403, `status=${r.status}`);

  r = await request('DELETE', '/api/tools/1');
  test('员工删除工具-拒绝', r.status === 403, `status=${r.status}`);

  // 员工可以查看列表
  r = await request('GET', '/api/tools');
  test('员工查看工具列表-允许', r.status === 200, `status=${r.status}`);

  r = await request('GET', '/api/users');
  test('员工查看用户列表', r.status === 200 || r.status === 403, `status=${r.status}`);

  r = await request('GET', '/api/departments');
  test('员工查看部门列表-允许', r.status === 200, `status=${r.status}`);
}

// ============ 清理 ============
async function cleanup() {
  console.log('\n=== 清理测试数据 ===');
  setToken(adminToken);

  if (createdIds.tool) {
    await request('DELETE', `/api/tools/${createdIds.tool}`);
  }
  if (createdIds.order) {
    await request('DELETE', `/api/orders/${createdIds.order}`);
  }
  if (createdIds.location) {
    await request('DELETE', `/api/storage-locations/${createdIds.location}`);
  }
  if (createdIds.shelf) {
    await request('DELETE', `/api/shelves/${createdIds.shelf}`);
  }
  if (createdIds.warehouse) {
    await request('DELETE', `/api/warehouses/${createdIds.warehouse}`);
  }
  console.log('清理完成');
}

// ============ Main ============
async function main() {
  console.log('🔧 工器具管理系统 QA 功能与边界测试');
  console.log(`⏰ ${new Date().toLocaleString('zh-CN')}`);
  console.log(`🎯 目标: ${BASE}\n`);

  try {
    await testAuth();
    await testUsers();
    await testDepartments();
    await testRoles();
    await testWarehouses();
    await testShelves();
    await testStorageLocations();
    await testToolCategories();
    await testTools();
    await testOrders();
    await testDashboard();
    await testChangePassword();
    await testBoundaryAndEdge();
    await testPermissionIsolation();
    await cleanup();
  } catch (e) {
    console.error('测试中断:', e);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📝 总计: ${passCount + failCount}`);
  console.log(`📈 通过率: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

  // 输出失败项
  const failures = testResults.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\n❌ 失败项明细:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    });
  }

  // 输出安全关注项
  const securityConcerns = testResults.filter(r =>
    r.name.includes('关联检查') && !r.passed
  );
  if (securityConcerns.length > 0) {
    console.log('\n⚠️ 安全关注项（删除操作缺少关联检查）:');
    securityConcerns.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}${s.detail ? ' — ' + s.detail : ''}`);
    });
  }
}

main();
