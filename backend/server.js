const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('⚠️  JWT_SECRET 未设置，使用临时密钥。生产环境请配置 .env 文件！');
  return require('crypto').randomBytes(32).toString('hex');
})();

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 生产环境下提供前端构建文件
const frontendDistPath = path.join(__dirname, '..', 'vue-frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  console.log(`前端静态文件目录: ${frontendDistPath}`);
}

// 登录速率限制
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分钟
  max: 20, // 每个 IP 最多 20 次登录尝试
  message: { message: '登录尝试次数过多，请 5 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 数据库文件
const DB_PATH = path.join(__dirname, 'db.json');

// 初始化数据库
const initDB = () => {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB = {
      users: [
        {
          user_id: 1,
          username: 'admin',
          password: bcrypt.hashSync('123456', 10),
          real_name: '系统管理员',
          dept_id: 1,
          role: 'admin',
          role_id: 1,
          role_name: '管理员',
          is_active: true,
          phone: '13800138000'
        },
        {
          user_id: 2,
          username: 'user1',
          password: bcrypt.hashSync('123456', 10),
          real_name: '张三',
          dept_id: 2,
          role: 'staff',
          role_id: 2,
          role_name: '普通员工',
          is_active: true,
          phone: '13800138001'
        }
      ],
      departments: [
        { dept_id: 1, dept_name: '管理部', dept_code: 'ADMIN', description: '' },
        { dept_id: 2, dept_name: '技术部', dept_code: 'TECH', description: '' }
      ],
      roles: [
        { role_id: 1, role_name: '管理员', role_code: 'admin', description: '', is_system: true, permission_ids: [] },
        { role_id: 2, role_name: '普通员工', role_code: 'staff', description: '', is_system: true, permission_ids: [] }
      ],
      warehouses: [
        { warehouse_id: 1, warehouse_name: '主仓库', warehouse_code: 'WH001', description: '主要工器具存放仓库', is_active: true }
      ],
      shelves: [
        { shelf_id: 1, warehouse_id: 1, shelf_name: 'A区', shelf_code: 'A', description: 'A区货架', is_active: true },
        { shelf_id: 2, warehouse_id: 1, shelf_name: 'B区', shelf_code: 'B', description: 'B区货架', is_active: true }
      ],
      storage_locations: [
        { location_id: 1, shelf_id: 1, warehouse_id: 1, location_name: '1排', location_code: 'A-01', description: 'A区1排货位', is_active: true },
        { location_id: 2, shelf_id: 2, warehouse_id: 1, location_name: '2排', location_code: 'B-02', description: 'B区2排货位', is_active: true }
      ],
      tools: [
        {
          tool_id: 1,
          tool_code: 'T001',
          tool_name: '电钻',
          category_id: 1,
          category_name: '电动工具',
          status: 'available',
          warehouse_id: 1,
          warehouse: '主仓库',
          shelf_id: 1,
          storage_location_id: 1,
          storage_location: 'A区1排',
          scene: '',
          borrow_count: 0,
          description: '优质电钻',
          image_url: '',
          purchase_date: '2024-01-01',
          scrap_date: null
        },
        {
          tool_id: 2,
          tool_code: 'T002',
          tool_name: '扳手',
          category_id: 2,
          category_name: '手动工具',
          status: 'available',
          warehouse_id: 1,
          warehouse: '主仓库',
          shelf_id: 2,
          storage_location_id: 2,
          storage_location: 'B区2排',
          scene: '',
          borrow_count: 0,
          description: '标准扳手',
          image_url: '',
          purchase_date: '2024-02-01',
          scrap_date: null
        }
      ],
      categories: [
        { category_id: 1, category_name: '电动工具', category_code: 'ELECTRIC', description: '', require_approval: false },
        { category_id: 2, category_name: '手动工具', category_code: 'MANUAL', description: '', require_approval: false }
      ],
      orders: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
  }
};

// 读取数据库
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('读取数据库失败:', err.message);
    throw new Error('数据库读取失败');
  }
};

// 写入数据库
const writeDB = (db) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('写入数据库失败:', err.message);
    throw new Error('数据库写入失败');
  }
};

// 认证中间件
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'token无效' });
  }
};

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

// ==================== 认证API ====================

// 登录
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { phone, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: '手机号或密码错误' });
  }

  if (!user.is_active) {
    return res.status(403).json({ message: '用户已被禁用' });
  }

  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({
    access_token: token,
    user: userWithoutPassword
  });
});

// 获取当前用户信息
app.get('/api/auth/me', authenticate, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }
  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// ==================== Dashboard API ====================

// 获取仪表盘统计数据
app.get('/api/dashboard', authenticate, (req, res) => {
  const db = readDB();
  const tools = db.tools || [];
  const orders = db.orders || [];

  const stats = {
    tools_total: tools.length,
    tools_available: tools.filter(t => t.status === 'available').length,
    tools_borrowed: tools.filter(t => t.status === 'borrowed').length,
    tools_maintenance: tools.filter(t => t.status === 'maintenance').length,
    orders_total: orders.length,
    orders_pending: orders.filter(o => o.status === 'pending').length,
    orders_approved: orders.filter(o => o.status === 'approved').length,
    orders_returned: orders.filter(o => o.status === 'returned').length,
    users_total: db.users.length
  };

  res.json(stats);
});

// ==================== 修改密码（用户自己修改） ====================
app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ message: '旧密码和新密码不能为空' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: '新密码长度不能小于6位' });
  }

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.user_id === req.user.user_id);

  if (userIndex === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  if (!bcrypt.compareSync(old_password, db.users[userIndex].password)) {
    return res.status(400).json({ message: '旧密码错误' });
  }

  db.users[userIndex].password = bcrypt.hashSync(new_password, 10);
  writeDB(db);

  res.json({ message: '密码修改成功' });
});

// ==================== 用户管理API ====================

// 获取用户列表
app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(({ password, ...user }) => user);
  res.json(users);
});

// 创建用户
app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { username, password = '123456', real_name, dept_id, role, is_active, phone } = req.body;

  // 必填字段校验
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ message: '用户名不能为空' });
  }
  if (!real_name || typeof real_name !== 'string' || !real_name.trim()) {
    return res.status(400).json({ message: '真实姓名不能为空' });
  }
  if (dept_id === undefined || dept_id === null) {
    return res.status(400).json({ message: '部门不能为空' });
  }

  const db = readDB();

  if (db.users.find(u => u.username === username.trim())) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const newUser = {
    user_id: Math.max(...db.users.map(u => u.user_id), 0) + 1,
    username,
    password: bcrypt.hashSync(password, 10),
    real_name,
    dept_id,
    role: role || 'staff',
    role_id: role === 'admin' ? 1 : 2,
    role_name: role === 'admin' ? '管理员' : '普通员工',
    is_active: is_active !== false,
    phone
  };

  db.users.push(newUser);
  writeDB(db);

  const { password: _, ...userWithoutPassword } = newUser;
  res.json(userWithoutPassword);
});

// 更新用户
app.put('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { real_name, dept_id, role, is_active, phone } = req.body;

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.user_id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  db.users[userIndex] = {
    ...db.users[userIndex],
    real_name: real_name || db.users[userIndex].real_name,
    dept_id: dept_id || db.users[userIndex].dept_id,
    role: role || db.users[userIndex].role,
    role_name: role === 'admin' ? '管理员' : role === 'staff' ? '普通员工' : db.users[userIndex].role_name,
    is_active: is_active !== undefined ? is_active : db.users[userIndex].is_active,
    phone: phone || db.users[userIndex].phone
  };

  writeDB(db);

  const { password, ...userWithoutPassword } = db.users[userIndex];
  res.json(userWithoutPassword);
});

// 重置密码（管理员）
app.post('/api/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { new_password = '123456' } = req.body;

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.user_id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  db.users[userIndex].password = bcrypt.hashSync(new_password, 10);
  writeDB(db);

  res.json({ message: '密码重置成功' });
});

// 删除用户
app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);

  const db = readDB();
  const userIndex = db.users.findIndex(u => u.user_id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  if (db.users[userIndex].role === 'admin') {
    return res.status(400).json({ message: '不能删除管理员' });
  }

  db.users.splice(userIndex, 1);
  writeDB(db);

  res.json({ message: '删除成功' });
});

// ==================== 部门管理API ====================

// 获取部门列表
app.get('/api/departments', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.departments || []);
});

// 创建部门
app.post('/api/departments', authenticate, requireAdmin, (req, res) => {
  const { dept_name, dept_code, description } = req.body;
  const db = readDB();

  if (db.departments.find(d => d.dept_code === dept_code)) {
    return res.status(400).json({ message: '部门编码已存在' });
  }

  const newDept = {
    dept_id: Math.max(...db.departments.map(d => d.dept_id), 0) + 1,
    dept_name,
    dept_code,
    description: description || ''
  };

  db.departments.push(newDept);
  writeDB(db);
  res.json(newDept);
});

// 更新部门
app.put('/api/departments/:id', authenticate, requireAdmin, (req, res) => {
  const deptId = parseInt(req.params.id);
  const { dept_name, dept_code, description } = req.body;
  const db = readDB();

  const deptIndex = db.departments.findIndex(d => d.dept_id === deptId);
  if (deptIndex === -1) {
    return res.status(404).json({ message: '部门不存在' });
  }

  db.departments[deptIndex] = {
    ...db.departments[deptIndex],
    dept_name: dept_name || db.departments[deptIndex].dept_name,
    dept_code: dept_code || db.departments[deptIndex].dept_code,
    description: description !== undefined ? description : db.departments[deptIndex].description
  };

  writeDB(db);
  res.json(db.departments[deptIndex]);
});

// 删除部门
app.delete('/api/departments/:id', authenticate, requireAdmin, (req, res) => {
  const deptId = parseInt(req.params.id);
  const db = readDB();

  const deptIndex = db.departments.findIndex(d => d.dept_id === deptId);
  if (deptIndex === -1) {
    return res.status(404).json({ message: '部门不存在' });
  }

  // 检查是否有用户属于该部门
  const usersInDept = db.users.filter(u => u.dept_id === deptId);
  if (usersInDept.length > 0) {
    return res.status(400).json({ message: `该部门下有 ${usersInDept.length} 个用户，无法删除` });
  }

  db.departments.splice(deptIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 角色管理API ====================

// 获取角色列表
app.get('/api/roles', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.roles || []);
});

// 创建角色
app.post('/api/roles', authenticate, requireAdmin, (req, res) => {
  const { role_name, role_code, description } = req.body;
  const db = readDB();

  if (db.roles.find(r => r.role_code === role_code)) {
    return res.status(400).json({ message: '角色编码已存在' });
  }

  const newRole = {
    role_id: Math.max(...db.roles.map(r => r.role_id), 0) + 1,
    role_name,
    role_code,
    description: description || '',
    is_system: false,
    permission_ids: []
  };

  db.roles.push(newRole);
  writeDB(db);
  res.json(newRole);
});

// 更新角色
app.put('/api/roles/:id', authenticate, requireAdmin, (req, res) => {
  const roleId = parseInt(req.params.id);
  const { role_name, role_code, description } = req.body;
  const db = readDB();

  const roleIndex = db.roles.findIndex(r => r.role_id === roleId);
  if (roleIndex === -1) {
    return res.status(404).json({ message: '角色不存在' });
  }

  db.roles[roleIndex] = {
    ...db.roles[roleIndex],
    role_name: role_name || db.roles[roleIndex].role_name,
    role_code: role_code || db.roles[roleIndex].role_code,
    description: description !== undefined ? description : db.roles[roleIndex].description
  };

  writeDB(db);
  res.json(db.roles[roleIndex]);
});

// 删除角色
app.delete('/api/roles/:id', authenticate, requireAdmin, (req, res) => {
  const roleId = parseInt(req.params.id);
  const db = readDB();

  const roleIndex = db.roles.findIndex(r => r.role_id === roleId);
  if (roleIndex === -1) {
    return res.status(404).json({ message: '角色不存在' });
  }

  if (db.roles[roleIndex].is_system) {
    return res.status(400).json({ message: '不能删除系统内置角色' });
  }

  db.roles.splice(roleIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 仓库管理API ====================

// 获取仓库列表
app.get('/api/warehouses', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.warehouses || []);
});

// 获取单个仓库
app.get('/api/warehouses/:id', authenticate, (req, res) => {
  const warehouseId = parseInt(req.params.id);
  const db = readDB();
  const warehouse = db.warehouses.find(w => w.warehouse_id === warehouseId);
  if (!warehouse) {
    return res.status(404).json({ message: '仓库不存在' });
  }
  res.json(warehouse);
});

// 创建仓库
app.post('/api/warehouses', authenticate, requireAdmin, (req, res) => {
  const { warehouse_name, warehouse_code, description } = req.body;
  const db = readDB();

  if (!warehouse_name || typeof warehouse_name !== 'string' || !warehouse_name.trim()) {
    return res.status(400).json({ message: '仓库名称不能为空' });
  }
  if (!warehouse_code || typeof warehouse_code !== 'string' || !warehouse_code.trim()) {
    return res.status(400).json({ message: '仓库编码不能为空' });
  }

  if (db.warehouses.find(w => w.warehouse_code === warehouse_code)) {
    return res.status(400).json({ message: '仓库编码已存在' });
  }

  const newWarehouse = {
    warehouse_id: Math.max(...db.warehouses.map(w => w.warehouse_id), 0) + 1,
    warehouse_name,
    warehouse_code,
    description: description || '',
    is_active: true
  };

  db.warehouses.push(newWarehouse);
  writeDB(db);
  res.json(newWarehouse);
});

// 更新仓库
app.put('/api/warehouses/:id', authenticate, requireAdmin, (req, res) => {
  const warehouseId = parseInt(req.params.id);
  const { warehouse_name, warehouse_code, description, is_active } = req.body;
  const db = readDB();

  const index = db.warehouses.findIndex(w => w.warehouse_id === warehouseId);
  if (index === -1) {
    return res.status(404).json({ message: '仓库不存在' });
  }

  if (warehouse_code && warehouse_code !== db.warehouses[index].warehouse_code) {
    if (db.warehouses.find(w => w.warehouse_code === warehouse_code)) {
      return res.status(400).json({ message: '仓库编码已存在' });
    }
  }

  const oldWarehouseName = db.warehouses[index].warehouse_name;

  db.warehouses[index] = {
    ...db.warehouses[index],
    warehouse_name: warehouse_name ?? db.warehouses[index].warehouse_name,
    warehouse_code: warehouse_code ?? db.warehouses[index].warehouse_code,
    description: description !== undefined ? description : db.warehouses[index].description,
    is_active: is_active !== undefined ? is_active : db.warehouses[index].is_active
  };

  writeDB(db);

  // 同步工具上的仓库名称
  const newWarehouseName = db.warehouses[index].warehouse_name;
  if (warehouse_name && warehouse_name.trim() && warehouse_name !== oldWarehouseName) {
    let changed = false;
    db.tools.forEach(t => {
      if (t.warehouse_id === warehouseId) {
        t.warehouse = newWarehouseName.trim();
        changed = true;
      }
    });
    if (changed) writeDB(db);
  }

  res.json(db.warehouses[index]);
});

// 删除仓库
app.delete('/api/warehouses/:id', authenticate, requireAdmin, (req, res) => {
  const warehouseId = parseInt(req.params.id);
  const db = readDB();

  const index = db.warehouses.findIndex(w => w.warehouse_id === warehouseId);
  if (index === -1) {
    return res.status(404).json({ message: '仓库不存在' });
  }

  // 检查是否有关联的货架
  const hasShelves = db.shelves.some(s => s.warehouse_id === warehouseId);
  if (hasShelves) {
    return res.status(400).json({ message: '请先删除该仓库下的所有货架' });
  }

  // 检查是否有关联的货位（即使货架已删除，可能存在孤立货位）
  const hasLocations = db.storage_locations.some(l => l.warehouse_id === warehouseId);
  if (hasLocations) {
    return res.status(400).json({ message: '请先删除该仓库下的所有货位' });
  }

  // 检查是否有关联的工具
  const hasTools = db.tools.some(t => t.warehouse_id === warehouseId);
  if (hasTools) {
    return res.status(400).json({ message: '该仓库下有关联的工具，无法删除' });
  }

  db.warehouses.splice(index, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 货架管理API ====================

// 获取货架列表（可按 warehouse_id 过滤）
app.get('/api/shelves', authenticate, (req, res) => {
  const db = readDB();
  let shelves = db.shelves || [];

  if (req.query.warehouse_id) {
    const warehouseId = parseInt(req.query.warehouse_id);
    shelves = shelves.filter(s => s.warehouse_id === warehouseId);
  }

  res.json(shelves);
});

// 获取单个货架
app.get('/api/shelves/:id', authenticate, (req, res) => {
  const shelfId = parseInt(req.params.id);
  const db = readDB();
  const shelf = db.shelves.find(s => s.shelf_id === shelfId);
  if (!shelf) {
    return res.status(404).json({ message: '货架不存在' });
  }
  res.json(shelf);
});

// 创建货架
app.post('/api/shelves', authenticate, requireAdmin, (req, res) => {
  const { warehouse_id, shelf_name, shelf_code, description } = req.body;
  const db = readDB();

  if (!shelf_name || typeof shelf_name !== 'string' || !shelf_name.trim()) {
    return res.status(400).json({ message: '货架名称不能为空' });
  }
  if (!shelf_code || typeof shelf_code !== 'string' || !shelf_code.trim()) {
    return res.status(400).json({ message: '货架编码不能为空' });
  }
  if (warehouse_id === undefined || warehouse_id === null) {
    return res.status(400).json({ message: '所属仓库不能为空' });
  }

  if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) {
    return res.status(400).json({ message: '所属仓库不存在' });
  }

  if (db.shelves.find(s => s.shelf_code === shelf_code)) {
    return res.status(400).json({ message: '货架编码已存在' });
  }

  const newShelf = {
    shelf_id: Math.max(...db.shelves.map(s => s.shelf_id), 0) + 1,
    warehouse_id,
    shelf_name,
    shelf_code,
    description: description || '',
    is_active: true
  };

  db.shelves.push(newShelf);
  writeDB(db);
  res.json(newShelf);
});

// 更新货架
app.put('/api/shelves/:id', authenticate, requireAdmin, (req, res) => {
  const shelfId = parseInt(req.params.id);
  const { warehouse_id, shelf_name, shelf_code, description, is_active } = req.body;
  const db = readDB();

  const index = db.shelves.findIndex(s => s.shelf_id === shelfId);
  if (index === -1) {
    return res.status(404).json({ message: '货架不存在' });
  }

  if (shelf_code && shelf_code !== db.shelves[index].shelf_code) {
    if (db.shelves.find(s => s.shelf_code === shelf_code)) {
      return res.status(400).json({ message: '货架编码已存在' });
    }
  }

  if (warehouse_id !== undefined && warehouse_id !== null) {
    if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) {
      return res.status(400).json({ message: '所属仓库不存在' });
    }
  }

  const oldShelfName = db.shelves[index].shelf_name;

  db.shelves[index] = {
    ...db.shelves[index],
    warehouse_id: warehouse_id ?? db.shelves[index].warehouse_id,
    shelf_name: shelf_name ?? db.shelves[index].shelf_name,
    shelf_code: shelf_code ?? db.shelves[index].shelf_code,
    description: description !== undefined ? description : db.shelves[index].description,
    is_active: is_active !== undefined ? is_active : db.shelves[index].is_active
  };

  writeDB(db);

  // 同步工具上的货位名称（shelfName + locationName）
  const newShelfName = db.shelves[index].shelf_name;
  if (shelf_name && shelf_name.trim() && shelf_name !== oldShelfName) {
    const shelfLocations = db.storage_locations.filter(l => l.shelf_id === shelfId);
    let changed = false;
    db.tools.forEach(t => {
      const loc = shelfLocations.find(l => l.location_id === t.storage_location_id);
      if (loc) {
        t.storage_location = `${newShelfName.trim()}${loc.location_name}`;
        changed = true;
      }
    });
    if (changed) writeDB(db);
  }

  res.json(db.shelves[index]);
});

// 删除货架
app.delete('/api/shelves/:id', authenticate, requireAdmin, (req, res) => {
  const shelfId = parseInt(req.params.id);
  const db = readDB();

  const index = db.shelves.findIndex(s => s.shelf_id === shelfId);
  if (index === -1) {
    return res.status(404).json({ message: '货架不存在' });
  }

  // 检查是否有关联的货位
  const hasLocations = db.storage_locations.some(l => l.shelf_id === shelfId);
  if (hasLocations) {
    return res.status(400).json({ message: '请先删除该货架下的所有货位' });
  }

  // 检查是否有关联的工具
  const hasTools = db.tools.some(t => t.shelf_id === shelfId);
  if (hasTools) {
    return res.status(400).json({ message: '该货架下有关联的工具，无法删除' });
  }

  db.shelves.splice(index, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 货位管理API ====================

// 获取货位列表（可按 shelf_id 或 warehouse_id 过滤）
app.get('/api/storage-locations', authenticate, (req, res) => {
  const db = readDB();
  let locations = db.storage_locations || [];

  if (req.query.shelf_id) {
    const shelfId = parseInt(req.query.shelf_id);
    locations = locations.filter(l => l.shelf_id === shelfId);
  }
  if (req.query.warehouse_id) {
    const warehouseId = parseInt(req.query.warehouse_id);
    locations = locations.filter(l => l.warehouse_id === warehouseId);
  }

  res.json(locations);
});

// 获取单个货位
app.get('/api/storage-locations/:id', authenticate, (req, res) => {
  const locationId = parseInt(req.params.id);
  const db = readDB();
  const location = db.storage_locations.find(l => l.location_id === locationId);
  if (!location) {
    return res.status(404).json({ message: '货位不存在' });
  }
  res.json(location);
});

// 创建货位
app.post('/api/storage-locations', authenticate, requireAdmin, (req, res) => {
  const { warehouse_id, shelf_id, location_name, location_code, description } = req.body;
  const db = readDB();

  if (!location_name || typeof location_name !== 'string' || !location_name.trim()) {
    return res.status(400).json({ message: '货位名称不能为空' });
  }
  if (!location_code || typeof location_code !== 'string' || !location_code.trim()) {
    return res.status(400).json({ message: '货位编码不能为空' });
  }
  if (warehouse_id === undefined || warehouse_id === null) {
    return res.status(400).json({ message: '所属仓库不能为空' });
  }
  if (shelf_id === undefined || shelf_id === null) {
    return res.status(400).json({ message: '所属货架不能为空' });
  }

  if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) {
    return res.status(400).json({ message: '所属仓库不存在' });
  }
  if (!db.shelves.find(s => s.shelf_id === shelf_id && s.warehouse_id === warehouse_id)) {
    return res.status(400).json({ message: '所属货架不存在或不属于该仓库' });
  }

  if (db.storage_locations.find(l => l.location_code === location_code)) {
    return res.status(400).json({ message: '货位编码已存在' });
  }

  const newLocation = {
    location_id: Math.max(...db.storage_locations.map(l => l.location_id), 0) + 1,
    warehouse_id,
    shelf_id,
    location_name,
    location_code,
    description: description || '',
    is_active: true
  };

  db.storage_locations.push(newLocation);
  writeDB(db);
  res.json(newLocation);
});

// 更新货位
app.put('/api/storage-locations/:id', authenticate, requireAdmin, (req, res) => {
  const locationId = parseInt(req.params.id);
  const { warehouse_id, shelf_id, location_name, location_code, description, is_active } = req.body;
  const db = readDB();

  const index = db.storage_locations.findIndex(l => l.location_id === locationId);
  if (index === -1) {
    return res.status(404).json({ message: '货位不存在' });
  }

  if (location_code && location_code !== db.storage_locations[index].location_code) {
    if (db.storage_locations.find(l => l.location_code === location_code)) {
      return res.status(400).json({ message: '货位编码已存在' });
    }
  }

  if (warehouse_id !== undefined && warehouse_id !== null) {
    if (!db.warehouses.find(w => w.warehouse_id === warehouse_id)) {
      return res.status(400).json({ message: '所属仓库不存在' });
    }
  }
  if (shelf_id !== undefined && shelf_id !== null) {
    const effectiveWarehouseId = warehouse_id !== undefined ? warehouse_id : db.storage_locations[index].warehouse_id;
    if (!db.shelves.find(s => s.shelf_id === shelf_id && s.warehouse_id === effectiveWarehouseId)) {
      return res.status(400).json({ message: '所属货架不存在或不属于该仓库' });
    }
  }
  if (warehouse_id !== undefined && shelf_id !== undefined && warehouse_id !== null && shelf_id !== null) {
    if (!db.shelves.find(s => s.shelf_id === shelf_id && s.warehouse_id === warehouse_id)) {
      return res.status(400).json({ message: '货架不属于指定的仓库' });
    }
  }

  db.storage_locations[index] = {
    ...db.storage_locations[index],
    warehouse_id: warehouse_id ?? db.storage_locations[index].warehouse_id,
    shelf_id: shelf_id ?? db.storage_locations[index].shelf_id,
    location_name: location_name ?? db.storage_locations[index].location_name,
    location_code: location_code ?? db.storage_locations[index].location_code,
    description: description !== undefined ? description : db.storage_locations[index].description,
    is_active: is_active !== undefined ? is_active : db.storage_locations[index].is_active
  };

  writeDB(db);
  res.json(db.storage_locations[index]);
});

// 删除货位
app.delete('/api/storage-locations/:id', authenticate, requireAdmin, (req, res) => {
  const locationId = parseInt(req.params.id);
  const db = readDB();

  const index = db.storage_locations.findIndex(l => l.location_id === locationId);
  if (index === -1) {
    return res.status(404).json({ message: '货位不存在' });
  }

  // 检查是否有关联的工具
  const hasTools = db.tools.some(t => t.storage_location_id === locationId);
  if (hasTools) {
    return res.status(400).json({ message: '该货位下有关联的工具，无法删除' });
  }

  db.storage_locations.splice(index, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 工具管理API ====================

// 获取工具列表
app.get('/api/tools', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.tools || []);
});

// 创建工具
app.post('/api/tools', authenticate, requireAdmin, (req, res) => {
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description } = req.body;
  const db = readDB();

  if (db.tools.find(t => t.tool_code === tool_code)) {
    return res.status(400).json({ message: '工具编码已存在' });
  }

  const warehouse = db.warehouses.find(w => w.warehouse_id === warehouse_id);
  const shelf = db.shelves.find(s => s.shelf_id === shelf_id);
  const location = db.storage_locations.find(l => l.location_id === storage_location_id);

  // 验证货架属于仓库
  if (shelf_id && warehouse_id) {
    if (shelf && shelf.warehouse_id !== warehouse_id) {
      return res.status(400).json({ message: '货架不属于所选仓库' });
    }
  }
  // 验证货位属于货架和仓库
  if (storage_location_id && shelf_id && warehouse_id) {
    if (location && (location.shelf_id !== shelf_id || location.warehouse_id !== warehouse_id)) {
      return res.status(400).json({ message: '货位不属于所选货架或仓库' });
    }
  }

  const newTool = {
    tool_id: Math.max(...db.tools.map(t => t.tool_id), 0) + 1,
    tool_code,
    tool_name,
    category_id,
    category_name: db.categories.find(c => c.category_id === category_id)?.category_name || '',
    status: status || 'available',
    warehouse_id: warehouse_id || null,
    warehouse: warehouse?.warehouse_name || '',
    shelf_id: shelf_id || null,
    storage_location_id: storage_location_id || null,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : '',
    scene: '',
    borrow_count: 0,
    description: description || '',
    image_url: '',
    purchase_date: null,
    scrap_date: null
  };

  db.tools.push(newTool);
  writeDB(db);
  res.json(newTool);
});

// 更新工具
app.put('/api/tools/:id', authenticate, requireAdmin, (req, res) => {
  const toolId = parseInt(req.params.id);
  const { tool_code, tool_name, category_id, warehouse_id, shelf_id, storage_location_id, status, description } = req.body;
  const db = readDB();

  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) {
    return res.status(404).json({ message: '工具不存在' });
  }

  const warehouse = warehouse_id ? db.warehouses.find(w => w.warehouse_id === warehouse_id) : null;
  const shelf = shelf_id ? db.shelves.find(s => s.shelf_id === shelf_id) : null;
  const location = storage_location_id ? db.storage_locations.find(l => l.location_id === storage_location_id) : null;

  // 验证货架属于仓库
  const effectiveWarehouseId = warehouse_id !== undefined ? warehouse_id : db.tools[toolIndex].warehouse_id;
  const effectiveShelfId = shelf_id !== undefined ? shelf_id : db.tools[toolIndex].shelf_id;
  if (effectiveShelfId && effectiveWarehouseId) {
    const effectiveShelf = db.shelves.find(s => s.shelf_id === effectiveShelfId);
    if (effectiveShelf && effectiveShelf.warehouse_id !== effectiveWarehouseId) {
      return res.status(400).json({ message: '货架不属于所选仓库' });
    }
  }
  // 验证货位属于货架和仓库
  const effectiveLocationId = storage_location_id !== undefined ? storage_location_id : db.tools[toolIndex].storage_location_id;
  if (effectiveLocationId && effectiveShelfId && effectiveWarehouseId) {
    const effectiveLocation = db.storage_locations.find(l => l.location_id === effectiveLocationId);
    if (effectiveLocation && (effectiveLocation.shelf_id !== effectiveShelfId || effectiveLocation.warehouse_id !== effectiveWarehouseId)) {
      return res.status(400).json({ message: '货位不属于所选货架或仓库' });
    }
  }

  db.tools[toolIndex] = {
    ...db.tools[toolIndex],
    tool_code: tool_code || db.tools[toolIndex].tool_code,
    tool_name: tool_name || db.tools[toolIndex].tool_name,
    category_id: category_id || db.tools[toolIndex].category_id,
    category_name: category_id ? db.categories.find(c => c.category_id === category_id)?.category_name : db.tools[toolIndex].category_name,
    warehouse_id: warehouse_id !== undefined ? warehouse_id : db.tools[toolIndex].warehouse_id,
    warehouse: warehouse ? warehouse.warehouse_name : (warehouse_id === null ? '' : db.tools[toolIndex].warehouse),
    shelf_id: shelf_id !== undefined ? shelf_id : db.tools[toolIndex].shelf_id,
    storage_location_id: storage_location_id !== undefined ? storage_location_id : db.tools[toolIndex].storage_location_id,
    storage_location: location ? `${shelf?.shelf_name || ''}${location.location_name}` : (storage_location_id === null ? '' : db.tools[toolIndex].storage_location),
    status: status || db.tools[toolIndex].status,
    description: description !== undefined ? description : db.tools[toolIndex].description
  };

  writeDB(db);
  res.json(db.tools[toolIndex]);
});

// 删除工具
app.delete('/api/tools/:id', authenticate, requireAdmin, (req, res) => {
  const toolId = parseInt(req.params.id);
  const db = readDB();

  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
  if (toolIndex === -1) {
    return res.status(404).json({ message: '工具不存在' });
  }

  db.tools.splice(toolIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 图片上传API ====================

const multer = require('multer');
const uploadDir = path.join(__dirname, 'uploads');

// 确保 uploads 目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 静态文件服务
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      return cb(new Error('只支持 JPG/PNG/GIF 格式'));
    }
    cb(null, `tool_${req.params.id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      return cb(new Error('只支持 JPG/PNG/GIF 格式'));
    }
    cb(null, true);
  }
});

app.post('/api/tools/:id/upload-image', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的图片' });
  }

  const toolId = parseInt(req.params.id);
  const db = readDB();
  const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);

  if (toolIndex === -1) {
    // 删除已上传的文件
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: '工具不存在' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  db.tools[toolIndex].image_url = imageUrl;
  writeDB(db);

  res.json({ message: '上传成功', image_url: imageUrl });
});

// ==================== 分类管理API ====================

// 获取分类列表
app.get('/api/tool-categories', authenticate, (req, res) => {
  const db = readDB();
  res.json(db.categories || []);
});

// 创建分类
app.post('/api/tool-categories', authenticate, requireAdmin, (req, res) => {
  const { category_name, category_code, description, require_approval } = req.body;
  const db = readDB();

  if (db.categories.find(c => c.category_code === category_code)) {
    return res.status(400).json({ message: '分类编码已存在' });
  }

  const newCategory = {
    category_id: Math.max(...db.categories.map(c => c.category_id), 0) + 1,
    category_name,
    category_code,
    description: description || '',
    require_approval: require_approval || false
  };

  db.categories.push(newCategory);
  writeDB(db);
  res.json(newCategory);
});

// 更新分类
app.put('/api/tool-categories/:id', authenticate, requireAdmin, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const { category_name, category_code, description, require_approval } = req.body;
  const db = readDB();

  const categoryIndex = db.categories.findIndex(c => c.category_id === categoryId);
  if (categoryIndex === -1) {
    return res.status(404).json({ message: '分类不存在' });
  }

  db.categories[categoryIndex] = {
    ...db.categories[categoryIndex],
    category_name: category_name || db.categories[categoryIndex].category_name,
    category_code: category_code || db.categories[categoryIndex].category_code,
    description: description !== undefined ? description : db.categories[categoryIndex].description,
    require_approval: require_approval !== undefined ? require_approval : db.categories[categoryIndex].require_approval
  };

  writeDB(db);
  res.json(db.categories[categoryIndex]);
});

// 删除分类
app.delete('/api/tool-categories/:id', authenticate, requireAdmin, (req, res) => {
  const categoryId = parseInt(req.params.id);
  const db = readDB();

  const categoryIndex = db.categories.findIndex(c => c.category_id === categoryId);
  if (categoryIndex === -1) {
    return res.status(404).json({ message: '分类不存在' });
  }

  // 检查是否有工具属于该分类
  const toolsInCategory = db.tools.filter(t => t.category_id === categoryId);
  if (toolsInCategory.length > 0) {
    return res.status(400).json({ message: `该分类下有 ${toolsInCategory.length} 个工具，无法删除` });
  }

  db.categories.splice(categoryIndex, 1);
  writeDB(db);
  res.json({ message: '删除成功' });
});

// ==================== 订单管理API ====================

// 获取订单列表
app.get('/api/orders', authenticate, (req, res) => {
  const db = readDB();
  const orders = db.orders || [];

  // 普通用户只能看自己的订单
  if (req.user.role !== 'admin') {
    const user = db.users.find(u => u.user_id === req.user.user_id);
    return res.json(orders.filter(o => o.borrower_name === (user?.real_name || user?.username)));
  }

  res.json(orders);
});

// 创建订单（购物车结算）
app.post('/api/orders', authenticate, (req, res) => {
  const { tool_ids, warehouse, scene, expected_return, purpose } = req.body;

  if (!tool_ids || !Array.isArray(tool_ids) || tool_ids.length === 0) {
    return res.status(400).json({ message: '请选择要领用的工具' });
  }

  const db = readDB();
  const user = db.users.find(u => u.user_id === req.user.user_id);

  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  // 检查工具是否可用
  const unavailableTools = [];
  for (const toolId of tool_ids) {
    const tool = db.tools.find(t => t.tool_id === toolId);
    if (!tool) {
      unavailableTools.push(`工具ID ${toolId} 不存在`);
    } else if (tool.status !== 'available') {
      unavailableTools.push(`${tool.tool_name} 当前状态为${tool.status}，不可领用`);
    }
  }

  if (unavailableTools.length > 0) {
    return res.status(400).json({ message: unavailableTools.join('；') });
  }

  // 生成订单号
  const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // 创建订单项
  const items = tool_ids.map(toolId => {
    const tool = db.tools.find(t => t.tool_id === toolId);
    return {
      item_id: Math.floor(Math.random() * 1000000),
      tool_id: toolId,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      item_status: 'reserved'
    };
  });

  const newOrder = {
    order_id: Math.max(...db.orders.map(o => o.order_id), 0) + 1,
    order_no: orderNo,
    borrower_name: user.real_name || user.username,
    borrower_id: user.user_id,
    status: 'pending',
    warehouse: warehouse || '',
    scene: scene || '',
    borrow_time: new Date().toISOString(),
    expected_return: expected_return || null,
    actual_return: null,
    purpose: purpose || '',
    require_approval: false,
    created_at: new Date().toISOString(),
    items: items
  };

  // 更新工具状态为预留（待审核通过后才变为借出）
  for (const toolId of tool_ids) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === toolId);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'reserved';
    }
  }

  db.orders.push(newOrder);
  writeDB(db);

  res.json(newOrder);
});

// 批准订单
app.post('/api/orders/:id/approve', authenticate, requireAdmin, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();

  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ message: '订单不存在' });
  }

  if (db.orders[orderIndex].status !== 'pending') {
    return res.status(400).json({ message: '只能批准待审核的订单' });
  }

  db.orders[orderIndex].status = 'borrowed';

  // 审核通过：工具从 reserved → borrowed，更新 item_status 和借出计数
  const order = db.orders[orderIndex];
  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'borrowed';
      db.tools[toolIndex].borrow_count = (db.tools[toolIndex].borrow_count || 0) + 1;
    }
    item.item_status = 'borrowed';
  }

  writeDB(db);

  res.json({ message: '已批准' });
});

// 拒绝订单
app.post('/api/orders/:id/reject', authenticate, requireAdmin, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();

  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ message: '订单不存在' });
  }

  if (db.orders[orderIndex].status !== 'pending') {
    return res.status(400).json({ message: '只能拒绝待审核的订单' });
  }

  // 恢复工具状态为可用
  const order = db.orders[orderIndex];
  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'available';
    }
  }

  db.orders[orderIndex].status = 'rejected';
  writeDB(db);

  res.json({ message: '已拒绝' });
});

// 归还订单
app.post('/api/orders/:id/return', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();

  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ message: '订单不存在' });
  }

  const order = db.orders[orderIndex];
  if (order.status !== 'borrowed') {
    return res.status(400).json({ message: '只能归还借出中的订单' });
  }

  // 检查权限：只能归还自己的订单，或者管理员可以归还任何订单
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) {
    return res.status(403).json({ message: '只能归还自己的订单' });
  }

  // 恢复工具状态为可用
  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'available';
    }
    item.item_status = 'returned';
  }

  db.orders[orderIndex].status = 'returned';
  db.orders[orderIndex].actual_return = new Date().toISOString();
  writeDB(db);

  res.json({ message: '已归还' });
});

// 取消订单
app.post('/api/orders/:id/cancel', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();

  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ message: '订单不存在' });
  }

  const order = db.orders[orderIndex];
  if (order.status !== 'pending') {
    return res.status(400).json({ message: '只能取消待审核的订单' });
  }

  // 检查权限：只能取消自己的订单，或者管理员可以取消任何订单
  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) {
    return res.status(403).json({ message: '只能取消自己的订单' });
  }

  // 恢复工具状态为可用
  for (const item of order.items) {
    const toolIndex = db.tools.findIndex(t => t.tool_id === item.tool_id);
    if (toolIndex > -1) {
      db.tools[toolIndex].status = 'available';
    }
  }

  db.orders[orderIndex].status = 'cancelled';
  writeDB(db);

  res.json({ message: '已取消' });
});

// 删除订单
app.delete('/api/orders/:id', authenticate, (req, res) => {
  const orderId = parseInt(req.params.id);
  const db = readDB();

  const orderIndex = db.orders.findIndex(o => o.order_id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ message: '订单不存在' });
  }

  const order = db.orders[orderIndex];

  // 检查权限：只能删除自己的订单，或者管理员可以删除任何订单
  // 只能删除已归还或已取消的订单
  if (!['returned', 'cancelled', 'rejected'].includes(order.status)) {
    return res.status(400).json({ message: '只能删除已归还、已取消或已拒绝的订单' });
  }

  if (req.user.role !== 'admin' && order.borrower_id !== req.user.user_id) {
    return res.status(403).json({ message: '只能删除自己的订单' });
  }

  db.orders.splice(orderIndex, 1);
  writeDB(db);

  res.json({ message: '删除成功' });
});

// ==================== 全局错误处理 ====================
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: '服务器内部错误', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// 404 处理 / SPA fallback
// app.use() 在所有路由之后执行，未匹配的请求会落入这里
app.use((req, res, next) => {
  // 如果是 API 路径，返回 JSON 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: '接口不存在' });
  }
  // 其他路径（SPA）：返回 index.html
  const indexPath = path.join(__dirname, '..', 'vue-frontend', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ message: '前端资源未构建，请先运行 npm run build' });
  }
});

// API 404 处理（仅对非 GET 请求生效，GET 请求已被上面的 SPA fallback 捕获）
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// ==================== 启动服务器 ====================
initDB();
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
