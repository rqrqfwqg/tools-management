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
        { warehouse_id: 1, warehouse_name: '主仓库', warehouse_code: 'WH001', description: '主要工器具存放仓库', is_active: true, dept_id: null }
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
      toolkits: [],
      toolkit_items: [],
      orders: [],
      // ===== 物料管理 v3.0.0 新增 5 张表（空表初始化） =====
      spare_parts: [],
      consumables: [],
      material_categories: [
        { category_id: 1, category_name: '通用备件', category_code: 'BJ-ALL', category_type: 'spare', description: '备件默认分类' },
        { category_id: 2, category_name: '通用消耗品', category_code: 'XH-ALL', category_type: 'consumable', description: '消耗品默认分类' },
        { category_id: 3, category_name: '通用物料', category_code: 'ALL', category_type: 'both', description: '备件与消耗品通用' }
      ],
      stock_movements: [],
      inventory_checks: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
  }
}

// 幂等迁移：为已存在的 db.json 补齐 v3.0.0 新增的 5 张表（不影响既有数据）
function migrateDB() {
  if (!fs.existsSync(DB_PATH)) return; // 不存在则交由 initDB 全量初始化
  const db = readDB();
  let changed = false;
  const newTables = {
    spare_parts: [],
    consumables: [],
    material_categories: [
      { category_id: 1, category_name: '通用备件', category_code: 'BJ-ALL', category_type: 'spare', description: '备件默认分类' },
      { category_id: 2, category_name: '通用消耗品', category_code: 'XH-ALL', category_type: 'consumable', description: '消耗品默认分类' },
      { category_id: 3, category_name: '通用物料', category_code: 'ALL', category_type: 'both', description: '备件与消耗品通用' }
    ],
    stock_movements: [],
    inventory_checks: [],
    safety_supplies: []
  };
  for (const key of Object.keys(newTables)) {
    if (!Array.isArray(db[key])) {
      db[key] = newTables[key];
      changed = true;
    }
  }
  // 安全防护用品模块：初始化全局设置（若不存在），存于 db.settings
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) {
    db.settings = {};
    changed = true;
  }
  // 兼容：material_categories 旧数据若没有 category_type 字段则补默认
  if (Array.isArray(db.material_categories)) {
    for (const c of db.material_categories) {
      if (!c.category_type) { c.category_type = 'both'; changed = true; }
    }
  }

  // 兼容迁移（合并自远程 toolkit 分支）：仓库/用户/工具箱字段补全
  // 1. 给已有仓库补 dept_id: null（如果缺失）
  if (db.warehouses && Array.isArray(db.warehouses)) {
    db.warehouses.forEach(w => {
      if (w.dept_id === undefined) { w.dept_id = null; changed = true; }
    });
  }
  // 2. 确保 phone=13800138000 的用户是 admin
  if (db.users && Array.isArray(db.users)) {
    const adminUser = db.users.find(u => u.phone === '13800138000');
    if (adminUser && adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      adminUser.role_id = 1;
      adminUser.role_name = '管理员';
      changed = true;
    }
  }
  // 2.5 给已有用户幂等补微信字段（微信小程序登录 v3.1.0，旧库启动不报错）
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach(u => {
      if (u.wx_openid === undefined || u.wx_openid === null) { u.wx_openid = ''; changed = true; }
      if (u.wx_nickname === undefined || u.wx_nickname === null) { u.wx_nickname = ''; changed = true; }
      if (u.wx_avatar === undefined || u.wx_avatar === null) { u.wx_avatar = ''; changed = true; }
    });
  }
  // 3. 给已有 toolkits 补 toolkit_code（格式 BX-{toolkit_id}）
  if (db.toolkits && Array.isArray(db.toolkits)) {
    db.toolkits.forEach(k => {
      if (!k.toolkit_code) {
        k.toolkit_code = `BX-${k.toolkit_id}`;
        changed = true;
      }
    });
  }
  // 4. 确保 toolkits 和 toolkit_items 集合存在
  if (!db.toolkits) { db.toolkits = []; changed = true; }
  if (!db.toolkit_items) { db.toolkit_items = []; changed = true; }

  if (changed) writeDB(db);
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

function nowCST() {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${y}-${M}-${d}T${h}:${m}:${s}.${ms}+08:00`;
}

module.exports = { initDB, migrateDB, readDB, writeDB, nextId, nowCST, DB_PATH };
