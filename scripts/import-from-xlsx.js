/**
 * 从 Excel 模板导入工具和人员数据到 db.json
 * Usage: node scripts/import-from-xlsx.js
 * 依赖临时 npm 包: npm install xlsx
 */

const XLSX = require('/tmp/node_modules/xlsx');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'backend', 'db.json');

// 读取数据库
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

// 工具函数：获取下一可用 ID
function nextId(arr) {
  const ids = arr.map(x => x[Object.keys(x).find(k => k.endsWith('_id'))]).filter(Boolean);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ---------- 工具导入 ----------
function importTools() {
  console.log('\n========== 导入工具 ==========');
  const wb = XLSX.readFile(path.join(__dirname, '..', '工具数据导入模板.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let imported = 0, skipped = 0;
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue; // 跳过空行
    const [code, name, categoryName, warehouseName, shelfName, locName, status, desc, purchaseDate, scene] = r;

    // 检查工具编码是否已存在
    if (db.tools.find(t => t.tool_code === String(code).trim())) {
      console.log(`⏭ 跳过已存在的工具: ${code} ${name}`);
      skipped++;
      continue;
    }

    // 查找或创建分类
    let cat = db.categories.find(c => c.category_name === String(categoryName).trim());
    if (!cat) {
      cat = { category_id: nextId(db.categories), category_name: String(categoryName).trim(), category_code: '', description: '', require_approval: false };
      db.categories.push(cat);
      console.log(`📁 自动创建分类: ${cat.category_name}`);
    }

    // 查找或创建仓库
    let wh = db.warehouses.find(w => w.warehouse_name === String(warehouseName).trim());
    if (!wh) {
      wh = { warehouse_id: nextId(db.warehouses), warehouse_name: String(warehouseName).trim(), warehouse_code: '', description: '' };
      db.warehouses.push(wh);
      console.log(`🏭 自动创建仓库: ${wh.warehouse_name}`);
    }

    // 查找或创建货架
    let shelf = null;
    if (shelfName) {
      shelf = db.shelves.find(s => s.shelf_name === String(shelfName).trim() && s.warehouse_id === wh.warehouse_id);
      if (!shelf) {
        shelf = { shelf_id: nextId(db.shelves), warehouse_id: wh.warehouse_id, shelf_name: String(shelfName).trim() };
        db.shelves.push(shelf);
        console.log(`📦 自动创建货架: ${shelf.shelf_name} (${wh.warehouse_name})`);
      }
    }

    // 查找或创建库位
    let loc = null;
    if (locName && shelf) {
      loc = db.storage_locations.find(l =>
        l.location_name === String(locName).trim() &&
        l.shelf_id === shelf.shelf_id &&
        l.warehouse_id === wh.warehouse_id
      );
      if (!loc) {
        loc = {
          location_id: nextId(db.storage_locations),
          shelf_id: shelf.shelf_id,
          warehouse_id: wh.warehouse_id,
          location_name: String(locName).trim(),
          location_code: '',
          description: '',
          is_active: true
        };
        db.storage_locations.push(loc);
        console.log(`📍 自动创建库位: ${loc.location_name}`);
      }
    }

    // 创建工具
    const tool = {
      tool_id: nextId(db.tools),
      tool_code: String(code).trim(),
      tool_name: String(name).trim(),
      category_id: cat.category_id,
      category_name: cat.category_name,
      status: String(status || 'available').trim(),
      warehouse_id: wh.warehouse_id,
      warehouse: wh.warehouse_name,
      shelf_id: shelf ? shelf.shelf_id : null,
      storage_location_id: loc ? loc.location_id : null,
      storage_location: loc ? loc.location_name : null,
      scene: scene ? String(scene).trim() : '',
      borrow_count: 0,
      description: desc ? String(desc).trim() : '',
      image_url: '',
      purchase_date: purchaseDate ? String(purchaseDate).trim() : '',
      scrap_date: '',
      toolkit_name: ''
    };
    db.tools.push(tool);
    imported++;
    console.log(`✅ 导入工具: ${tool.tool_code} ${tool.tool_name}`);
  }
  console.log(`📊 工具导入完成: 新增 ${imported} 个, 跳过 ${skipped} 个`);
}

// ---------- 人员导入 ----------
function importUsers() {
  console.log('\n========== 导入人员 ==========');
  const wb = XLSX.readFile(path.join(__dirname, '..', '人员数据导入模板.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let imported = 0, skipped = 0;
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const [username, realName, phone, password, deptName, roleName] = r;

    // 检查是否已存在（用手机号或用户名判断）
    const phoneStr = String(phone).trim();
    const usernameStr = String(username).trim();
    if (db.users.find(u => u.phone === phoneStr || u.username === usernameStr)) {
      console.log(`⏭ 跳过已存在用户: ${usernameStr} ${realName}`);
      skipped++;
      continue;
    }

    // 查找或创建部门
    let dept = db.departments.find(d => d.dept_name === String(deptName).trim());
    if (!dept) {
      dept = { dept_id: nextId(db.departments), dept_name: String(deptName).trim(), dept_code: '' };
      db.departments.push(dept);
      console.log(`🏢 自动创建部门: ${dept.dept_name}`);
    }

    // 查找角色
    let role = db.roles.find(r => r.role_name === String(roleName).trim());
    if (!role) {
      role = { role_id: nextId(db.roles), role_name: String(roleName).trim(), role_code: '' };
      db.roles.push(role);
      console.log(`👤 自动创建角色: ${role.role_name}`);
    }

    const pwd = password ? String(password).trim() : '123456';
    const user = {
      user_id: nextId(db.users),
      username: usernameStr,
      password: bcrypt.hashSync(pwd, 10),
      real_name: realName ? String(realName).trim() : '',
      dept_id: dept.dept_id,
      role: role.role_code,
      role_id: role.role_id,
      role_name: role.role_name,
      is_active: true,
      phone: phoneStr
    };
    db.users.push(user);
    imported++;
    console.log(`✅ 导入用户: ${user.username} ${user.real_name} (${role.role_name})`);
  }
  console.log(`📊 人员导入完成: 新增 ${imported} 个, 跳过 ${skipped} 个`);
}

// 执行导入
importTools();
importUsers();

// 写回数据库
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
console.log('\n✅ 数据已保存到 db.json');
