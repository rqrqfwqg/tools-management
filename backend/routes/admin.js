// 仓库、货架、货位、部门、角色管理路由
const express = require('express');
const { readDB, writeDB, nextId } = require('./db');
const { authenticate, requireAdmin, requireMaterialManager } = require('../middleware/auth');

const router = express.Router();

// ========== 仓库管理 ==========
router.get('/warehouses', authenticate, (req, res) => {
  const db = readDB();
  let warehouses = db.warehouses || [];
  // 非 admin/material_manager 只能看本部门 + 共享仓库
  if (req.user.role !== 'admin' && req.user.role !== 'material_manager') {
    const user = db.users.find(u => u.user_id === req.user.user_id);
    const userDeptId = user?.dept_id;
    warehouses = warehouses.filter(w => w.dept_id === null || w.dept_id === undefined || w.dept_id === userDeptId);
  }
  // 注入 dept_name 方便前端显示
  const departments = db.departments || [];
  const result = warehouses.map(w => ({
    ...w,
    dept_name: w.dept_id ? (departments.find(d => d.dept_id === w.dept_id)?.dept_name || '') : '共享'
  }));
  res.json(result);
});

router.get('/warehouses/:id', authenticate, (req, res) => {
  const w = readDB().warehouses.find(w => w.warehouse_id === parseInt(req.params.id));
  if (!w) return res.status(404).json({ message: '仓库不存在' });
  res.json(w);
});

router.post('/warehouses', authenticate, requireMaterialManager, (req, res) => {
  const { warehouse_name, warehouse_code, description } = req.body;
  if (!warehouse_name?.trim()) return res.status(400).json({ message: '仓库名称不能为空' });
  if (!warehouse_code?.trim()) return res.status(400).json({ message: '仓库编码不能为空' });

  const db = readDB();
  if (db.warehouses.find(w => w.warehouse_code === warehouse_code)) {
    return res.status(400).json({ message: '仓库编码已存在' });
  }

  const newWarehouse = {
    warehouse_id: nextId(db.warehouses, 'warehouse_id'),
    warehouse_name, warehouse_code, description: description || '',
    is_active: true, is_restricted: req.body.is_restricted !== undefined ? req.body.is_restricted : true,
    dept_id: req.body.dept_id !== undefined ? req.body.dept_id : null
  };
  db.warehouses.push(newWarehouse);
  writeDB(db);
  res.json(newWarehouse);
});

router.put('/warehouses/:id', authenticate, requireMaterialManager, (req, res) => {
  const warehouseId = parseInt(req.params.id);
  const { warehouse_name, warehouse_code, description, is_active } = req.body;
  const db = readDB();
  const idx = db.warehouses.findIndex(w => w.warehouse_id === warehouseId);
  if (idx === -1) return res.status(404).json({ message: '仓库不存在' });

  if (warehouse_code && warehouse_code !== db.warehouses[idx].warehouse_code && db.warehouses.find(w => w.warehouse_code === warehouse_code)) {
    return res.status(400).json({ message: '仓库编码已存在' });
  }

  const oldName = db.warehouses[idx].warehouse_name;
  db.warehouses[idx] = {
    ...db.warehouses[idx],
    warehouse_name: warehouse_name ?? db.warehouses[idx].warehouse_name,
    warehouse_code: warehouse_code ?? db.warehouses[idx].warehouse_code,
    description: description !== undefined ? description : db.warehouses[idx].description,
    is_active: is_active !== undefined ? is_active : db.warehouses[idx].is_active,
    dept_id: req.body.dept_id !== undefined ? req.body.dept_id : db.warehouses[idx].dept_id
  };
  writeDB(db);

  if (warehouse_name?.trim() && warehouse_name !== oldName) {
    db.tools.forEach(t => { if (t.warehouse_id === warehouseId) t.warehouse = warehouse_name.trim(); });
    writeDB(db);
  }
  res.json(db.warehouses[idx]);
});

router.delete('/warehouses/:id', authenticate, requireMaterialManager, (req, res) => {
  const warehouseId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.warehouses.findIndex(w => w.warehouse_id === warehouseId);
  if (idx === -1) return res.status(404).json({ message: '仓库不存在' });
  if (db.shelves.some(s => s.warehouse_id === warehouseId)) return res.status(400).json({ message: '请先删除该仓库下的所有货架' });
  if (db.tools.some(t => t.warehouse_id === warehouseId)) return res.status(400).json({ message: '该仓库下有关联的工具' });
  db.warehouses.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ========== 货架管理 ==========
router.get('/shelves', authenticate, (req, res) => {
  const db = readDB();
  let shelves = db.shelves || [];
  if (req.query.warehouse_id) shelves = shelves.filter(s => s.warehouse_id === parseInt(req.query.warehouse_id));
  res.json(shelves);
});

router.post('/shelves', authenticate, requireMaterialManager, (req, res) => {
  const { warehouse_id, shelf_name, shelf_code, description } = req.body;
  if (!shelf_name?.trim()) return res.status(400).json({ message: '货架名称不能为空' });
  if (!shelf_code?.trim()) return res.status(400).json({ message: '货架编码不能为空' });
  if (!warehouse_id) return res.status(400).json({ message: '所属仓库不能为空' });

  const db = readDB();
  if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) return res.status(400).json({ message: '所属仓库不存在' });
  if (db.shelves.find(s => s.shelf_code === shelf_code)) return res.status(400).json({ message: '货架编码已存在' });

  const newShelf = { shelf_id: nextId(db.shelves, 'shelf_id'), warehouse_id, shelf_name, shelf_code, description: description || '', is_active: true };
  db.shelves.push(newShelf);
  writeDB(db);
  res.json(newShelf);
});

router.put('/shelves/:id', authenticate, requireMaterialManager, (req, res) => {
  const shelfId = parseInt(req.params.id);
  const { warehouse_id, shelf_name, shelf_code, description, is_active } = req.body;
  const db = readDB();
  const idx = db.shelves.findIndex(s => s.shelf_id === shelfId);
  if (idx === -1) return res.status(404).json({ message: '货架不存在' });
  if (shelf_code && shelf_code !== db.shelves[idx].shelf_code && db.shelves.find(s => s.shelf_code === shelf_code)) return res.status(400).json({ message: '货架编码已存在' });

  db.shelves[idx] = { ...db.shelves[idx], warehouse_id: warehouse_id ?? db.shelves[idx].warehouse_id, shelf_name: shelf_name ?? db.shelves[idx].shelf_name, shelf_code: shelf_code ?? db.shelves[idx].shelf_code, description: description !== undefined ? description : db.shelves[idx].description, is_active: is_active !== undefined ? is_active : db.shelves[idx].is_active };
  writeDB(db);
  res.json(db.shelves[idx]);
});

router.delete('/shelves/:id', authenticate, requireMaterialManager, (req, res) => {
  const shelfId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.shelves.findIndex(s => s.shelf_id === shelfId);
  if (idx === -1) return res.status(404).json({ message: '货架不存在' });
  if (db.storage_locations.some(l => l.shelf_id === shelfId)) return res.status(400).json({ message: '请先删除该货架下的所有货位' });
  if (db.tools.some(t => t.shelf_id === shelfId)) return res.status(400).json({ message: '该货架下有关联的工具' });
  db.shelves.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ========== 货位管理 ==========
router.get('/storage-locations', authenticate, (req, res) => {
  const db = readDB();
  let locations = db.storage_locations || [];
  if (req.query.shelf_id) locations = locations.filter(l => l.shelf_id === parseInt(req.query.shelf_id));
  if (req.query.warehouse_id) locations = locations.filter(l => l.warehouse_id === parseInt(req.query.warehouse_id));
  res.json(locations);
});

router.post('/storage-locations', authenticate, requireMaterialManager, (req, res) => {
  const { warehouse_id, shelf_id, location_name, location_code, description } = req.body;
  if (!location_name?.trim() || !location_code?.trim() || !warehouse_id || !shelf_id) return res.status(400).json({ message: '必填字段不能为空' });

  const db = readDB();
  if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) return res.status(400).json({ message: '所属仓库不存在' });
  if (!db.shelves.find(s => s.shelf_id === shelf_id && s.warehouse_id === warehouse_id)) return res.status(400).json({ message: '所属货架不存在或不属于该仓库' });
  if (db.storage_locations.find(l => l.location_code === location_code)) return res.status(400).json({ message: '货位编码已存在' });

  const newLoc = { location_id: nextId(db.storage_locations, 'location_id'), warehouse_id, shelf_id, location_name, location_code, description: description || '', is_active: true };
  db.storage_locations.push(newLoc);
  writeDB(db);
  res.json(newLoc);
});

router.put('/storage-locations/:id', authenticate, requireMaterialManager, (req, res) => {
  const locId = parseInt(req.params.id);
  const { warehouse_id, shelf_id, location_name, location_code, description, is_active } = req.body;
  const db = readDB();
  const idx = db.storage_locations.findIndex(l => l.location_id === locId);
  if (idx === -1) return res.status(404).json({ message: '货位不存在' });

  db.storage_locations[idx] = { ...db.storage_locations[idx], warehouse_id: warehouse_id ?? db.storage_locations[idx].warehouse_id, shelf_id: shelf_id ?? db.storage_locations[idx].shelf_id, location_name: location_name ?? db.storage_locations[idx].location_name, location_code: location_code ?? db.storage_locations[idx].location_code, description: description !== undefined ? description : db.storage_locations[idx].description, is_active: is_active !== undefined ? is_active : db.storage_locations[idx].is_active };
  writeDB(db);
  res.json(db.storage_locations[idx]);
});

router.delete('/storage-locations/:id', authenticate, requireMaterialManager, (req, res) => {
  const locId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.storage_locations.findIndex(l => l.location_id === locId);
  if (idx === -1) return res.status(404).json({ message: '货位不存在' });
  if (db.tools.some(t => t.storage_location_id === locId)) return res.status(400).json({ message: '该货位下有关联的工具' });
  db.storage_locations.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ========== 部门管理 ==========
router.get('/departments', authenticate, (req, res) => {
  res.json(readDB().departments || []);
});

router.post('/departments', authenticate, requireAdmin, (req, res) => {
  const { dept_name, dept_code, description } = req.body;
  const db = readDB();
  if (db.departments.find(d => d.dept_code === dept_code)) return res.status(400).json({ message: '部门编码已存在' });
  const newDept = { dept_id: nextId(db.departments, 'dept_id'), dept_name, dept_code, description: description || '' };
  db.departments.push(newDept);
  writeDB(db);
  res.json(newDept);
});

router.put('/departments/:id', authenticate, requireAdmin, (req, res) => {
  const deptId = parseInt(req.params.id);
  const { dept_name, dept_code, description } = req.body;
  const db = readDB();
  const idx = db.departments.findIndex(d => d.dept_id === deptId);
  if (idx === -1) return res.status(404).json({ message: '部门不存在' });
  db.departments[idx] = { ...db.departments[idx], dept_name: dept_name || db.departments[idx].dept_name, dept_code: dept_code || db.departments[idx].dept_code, description: description !== undefined ? description : db.departments[idx].description };
  writeDB(db);
  res.json(db.departments[idx]);
});

router.delete('/departments/:id', authenticate, requireAdmin, (req, res) => {
  const deptId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.departments.findIndex(d => d.dept_id === deptId);
  if (idx === -1) return res.status(404).json({ message: '部门不存在' });
  if (db.users.filter(u => u.dept_id === deptId).length > 0) return res.status(400).json({ message: '该部门下有用户，无法删除' });
  db.departments.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ========== 角色管理 ==========
router.get('/roles', authenticate, (req, res) => {
  const db = readDB();
  const roles = (db.roles || []).map(r => ({
    ...r,
    user_count: (db.users || []).filter(u => u.role === r.role_code).length
  }));
  res.json(roles);
});

router.get('/roles/:id', authenticate, (req, res) => {
  const db = readDB();
  const r = db.roles.find(r => r.role_id === parseInt(req.params.id));
  if (!r) return res.status(404).json({ message: '角色不存在' });
  res.json({ ...r, user_count: (db.users || []).filter(u => u.role === r.role_code).length });
});

router.post('/roles', authenticate, requireAdmin, (req, res) => {
  const { role_name, role_code, description, permissions } = req.body;
  if (!role_name?.trim()) return res.status(400).json({ message: '角色名称不能为空' });
  if (!role_code?.trim()) return res.status(400).json({ message: '角色编码不能为空' });
  const db = readDB();
  if (db.roles.find(r => r.role_code === role_code)) return res.status(400).json({ message: '角色编码已存在' });
  const defaultPerms = { approve_orders: false, manage_tools: false, manage_warehouses: false, manage_users: false, manage_categories: false };
  const newRole = {
    role_id: nextId(db.roles, 'role_id'),
    role_name: role_name.trim(),
    role_code: role_code.trim(),
    description: description || '',
    is_system: false,
    permissions: permissions || defaultPerms
  };
  db.roles.push(newRole);
  writeDB(db);
  res.json(newRole);
});

router.put('/roles/:id', authenticate, requireAdmin, (req, res) => {
  const roleId = parseInt(req.params.id);
  const { role_name, role_code, description, permissions } = req.body;
  const db = readDB();
  const idx = db.roles.findIndex(r => r.role_id === roleId);
  if (idx === -1) return res.status(404).json({ message: '角色不存在' });
  const role = db.roles[idx];
  if (role_name !== undefined) role.role_name = role_name;
  if (role_code !== undefined) role.role_code = role_code;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = permissions;

  // 同步已有用户的 role_name
  if (role_name || role_code) {
    db.users.forEach(u => {
      if (u.role_id === roleId) {
        if (role_name) u.role_name = role_name;
        if (role_code) u.role = role_code;
      }
    });
  }
  writeDB(db);
  res.json({ ...role, user_count: (db.users || []).filter(u => u.role === role.role_code).length });
});

router.delete('/roles/:id', authenticate, requireAdmin, (req, res) => {
  const roleId = parseInt(req.params.id);
  const db = readDB();
  const idx = db.roles.findIndex(r => r.role_id === roleId);
  if (idx === -1) return res.status(404).json({ message: '角色不存在' });
  if (db.roles[idx].is_system) return res.status(400).json({ message: '不能删除系统内置角色' });
  if ((db.users || []).some(u => u.role === db.roles[idx].role_code)) return res.status(400).json({ message: '该角色下有用户，无法删除' });
  db.roles.splice(idx, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

module.exports = router;
