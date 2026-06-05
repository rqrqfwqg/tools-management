// 数据库操作模块 - JSON 文件数据库
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'db.json');
let dbWriteLock = false;

// 初始化数据库
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultPassword = require('bcryptjs').hashSync(
      process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@2026!', 10
    );
    const defaultUserPassword = require('bcryptjs').hashSync(
      process.env.DEFAULT_USER_PASSWORD || 'User@2026!', 10
    );

    const initialDB = {
      users: [
        {
          user_id: 1, username: 'admin',
          password: defaultPassword, real_name: '系统管理员',
          dept_id: 1, role: 'admin', role_id: 1, role_name: '管理员',
          is_active: true, phone: '13800138000'
        },
        {
          user_id: 2, username: 'user1',
          password: defaultUserPassword, real_name: '张三',
          dept_id: 2, role: 'staff', role_id: 2, role_name: '普通员工',
          is_active: true, phone: '13800138001'
        }
      ],
      departments: [
        { dept_id: 1, dept_name: '管理部', dept_code: 'ADMIN', description: '' },
        { dept_id: 2, dept_name: '技术部', dept_code: 'TECH', description: '' }
      ],
      roles: [
        { role_id: 1, role_name: '管理员', role_code: 'admin', description: '系统管理员，拥有全部权限', is_system: true, permissions: { approve_orders: true, manage_tools: true, manage_warehouses: true, manage_users: true, manage_categories: true } },
        { role_id: 2, role_name: '普通员工', role_code: 'staff', description: '普通员工，可领用和归还工具', is_system: true, permissions: { approve_orders: false, manage_tools: false, manage_warehouses: false, manage_users: false, manage_categories: false } },
        { role_id: 3, role_name: '分队长', role_code: 'team_leader', description: '可审批工单', is_system: true, permissions: { approve_orders: true, manage_tools: false, manage_warehouses: false, manage_users: false, manage_categories: false } },
        { role_id: 4, role_name: '物料管理员', role_code: 'material_manager', description: '管理仓库、工具及工具类型', is_system: true, permissions: { approve_orders: false, manage_tools: true, manage_warehouses: true, manage_users: false, manage_categories: true } }
      ],
      warehouses: [
        { warehouse_id: 1, warehouse_name: '主仓库', warehouse_code: 'WH001', description: '主要工器具存放仓库', is_active: true, is_restricted: true }
      ],
      shelves: [
        { shelf_id: 1, warehouse_id: 1, shelf_name: 'A区', shelf_code: 'A', description: 'A区货架', is_active: true },
        { shelf_id: 2, warehouse_id: 1, shelf_name: 'B区', shelf_code: 'B', description: 'B区货架', is_active: true }
      ],
      storage_locations: [
        { location_id: 1, shelf_id: 1, warehouse_id: 1, location_name: '1排', location_code: 'A-01', description: 'A区1排货位', is_active: true },
        { location_id: 2, shelf_id: 2, warehouse_id: 1, location_name: '2排', location_code: 'B-02', description: 'B区2排货位', is_active: true }
      ],
      tools: [],
      categories: [
        { category_id: 1, category_name: '电动工具', category_code: 'ELECTRIC', description: '', require_approval: false },
        { category_id: 2, category_name: '手动工具', category_code: 'MANUAL', description: '', require_approval: false }
      ],
      orders: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
  }
}

// 读取数据库
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取数据库失败:', err.message);
    throw new Error('数据库读取失败');
  }
}

// 写入数据库（带并发锁）
function writeDB(db) {
  try {
    const maxWait = 5000;
    const start = Date.now();
    while (dbWriteLock) {
      if (Date.now() - start > maxWait) throw new Error('数据库写入超时');
    }
    dbWriteLock = true;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    dbWriteLock = false;
  } catch (err) {
    dbWriteLock = false;
    console.error('写入数据库失败:', err.message);
    throw new Error('数据库写入失败');
  }
}

// 获取下一个 ID
function nextId(arr, key) {
  return Math.max(...arr.map(item => item[key]), 0) + 1;
}

module.exports = { initDB, readDB, writeDB, nextId, DB_PATH };
